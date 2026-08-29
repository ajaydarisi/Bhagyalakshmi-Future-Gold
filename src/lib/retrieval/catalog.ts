import { createHash } from "node:crypto";
import { embedText, serializeVector } from "@/lib/ai/gemini";
import { ROUTES } from "@/lib/constants";
import {
  buildPublicRetrievalDocuments,
  type PublicCatalogSummaryProduct,
  PUBLIC_RETRIEVAL_LOCALES,
} from "@/lib/retrieval/public-documents";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";
import type {
  CatalogSearchResponse,
  CatalogSourceType,
  ProductSearchFilters,
  ProductSearchHit,
  RetrievedCatalogContext,
  RetrievedContextItem,
  RetrievalMode,
  RetrievalStatus,
} from "@/types/search";

type ProductRetrievalRow =
  Database["public"]["Functions"]["hybrid_search_products"]["Returns"][number];

type CatalogRetrievalDocumentRow =
  Database["public"]["Tables"]["catalog_retrieval_documents"]["Row"];

type RetrievalDocumentInput = {
  sourceType: CatalogSourceType;
  sourceKey: string;
  productId: string | null;
  locale: string;
  title: string;
  content: string;
  metadata: Json;
  contentHash: string;
};

type RetrievalProduct = Database["public"]["Tables"]["products"]["Row"] & {
  category: {
    name: string;
    name_telugu: string | null;
    slug: string;
  } | null;
};

type ProductSearchResult = {
  items: ProductSearchHit[];
  mode: "keyword" | "hybrid";
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
};

type StorefrontFilterQuery<TQuery> = {
  eq: (column: string, value: unknown) => TQuery;
  in: (column: string, values: unknown[]) => TQuery;
  overlaps: (column: string, values: unknown[]) => TQuery;
  or: (filters: string) => TQuery;
};

const PRODUCT_RETRIEVAL_SELECT =
  "*, category:categories(name, name_telugu, slug)";
const PUBLIC_SOURCE_TYPES: CatalogSourceType[] = ["store_info", "faq", "legal"];
const GENERIC_ASSISTANT_PRODUCT_FALLBACK_QUERIES = new Set([
  "catalog",
  "catalogue",
  "jewellery",
  "jewelry",
  "product",
  "products",
  "rental jewellery",
  "rental jewelry",
]);

export interface CatalogRetrievalHealth {
  activeProductCount: number;
  indexedProductDocumentCount: number;
  indexedPublicDocumentCount: number;
  failedDocumentCount: number;
  expectedPublicDocumentCount: number;
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function buildProductMetadata(product: RetrievalProduct) {
  return {
    productId: product.id,
    slug: product.slug,
    categorySlug: product.category?.slug ?? null,
    categoryName: product.category?.name ?? null,
    categoryNameTelugu: product.category?.name_telugu ?? null,
    material: product.material ?? null,
    tags: product.tags,
    isSale: product.is_sale,
    isRental: product.is_rental,
    featured: product.featured,
    stock: product.stock,
    price: product.price,
    discountPrice: product.discount_price,
    rentalPrice: product.rental_price,
    rentalDiscountPrice: product.rental_discount_price,
    rentalDeposit: product.rental_deposit,
    maxRentalDays: product.max_rental_days,
    setNumber: product.set_number,
  } as const satisfies Json;
}

function buildProductRetrievalDocument(product: RetrievalProduct): RetrievalDocumentInput {
  const name = normalizeText(product.name);
  const nameTelugu = normalizeText(product.name_telugu);
  const description = normalizeText(product.description);
  const descriptionTelugu = normalizeText(product.description_telugu);
  const categoryName = normalizeText(product.category?.name);
  const categoryNameTelugu = normalizeText(product.category?.name_telugu);
  const categorySlug = normalizeText(product.category?.slug);
  const material = normalizeText(product.material);
  const tags = product.tags.filter(Boolean);

  const priceLine = product.is_rental && !product.is_sale
    ? `Rental price ${product.rental_discount_price ?? product.rental_price ?? 0} INR per day`
    : `Sale price ${product.discount_price ?? product.price} INR`;

  const availabilityParts = [
    product.is_sale ? "Available for sale" : null,
    product.is_rental ? "Available for rent" : null,
    product.featured ? "Featured product" : null,
    product.stock > 0 ? `In stock ${product.stock}` : "Out of stock",
    product.set_number ? `Set number ${product.set_number}` : null,
  ].filter(Boolean);

  const searchKeywords = [
    name,
    nameTelugu,
    name,
    nameTelugu,
    categoryName,
    categoryNameTelugu,
    categorySlug,
    categoryName,
    categoryNameTelugu,
    material,
    ...tags,
    ...tags,
  ].filter(Boolean);

  const title = [name, nameTelugu].filter(Boolean).join(" / ") || name;

  const content = [
    `Search keywords: ${searchKeywords.join(", ")}`,
    categoryName ? `Category: ${categoryName}` : null,
    categoryNameTelugu ? `Category Telugu: ${categoryNameTelugu}` : null,
    material ? `Material: ${material}` : null,
    tags.length > 0 ? `Tags: ${tags.join(", ")}` : null,
    description ? `Description: ${description}` : null,
    descriptionTelugu ? `Description Telugu: ${descriptionTelugu}` : null,
    priceLine,
    availabilityParts.join(". "),
  ]
    .filter(Boolean)
    .join("\n");

  const metadata = buildProductMetadata(product);
  const contentHash = createHash("sha256")
    .update(JSON.stringify({ title, content, metadata }))
    .digest("hex");

  return {
    sourceType: "product",
    sourceKey: `product:${product.id}`,
    productId: product.id,
    locale: "multi",
    title,
    content,
    metadata,
    contentHash,
  };
}

async function getProductForRetrieval(productId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .select(PRODUCT_RETRIEVAL_SELECT)
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as RetrievalProduct | null;
}

async function getActiveProductsForPublicDocuments() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .select(PRODUCT_RETRIEVAL_SELECT)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PublicCatalogSummaryProduct[];
}

function toFilters(filters?: ProductSearchFilters) {
  return {
    categoryIds: filters?.categoryIds ?? [],
    materials: filters?.materials ?? [],
    tags: filters?.tags ?? [],
    type: filters?.type ?? "all",
    minPrice: filters?.minPrice ?? 0,
    maxPrice: filters?.maxPrice ?? 0,
  };
}

function escapeFallbackQueryValue(value: string) {
  return value.replace(/[,%()"]/g, " ").replace(/\s+/g, " ").trim();
}

export function isGenericAssistantProductFallbackQuery(query: string) {
  const normalized = normalizeText(query)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ");

  return GENERIC_ASSISTANT_PRODUCT_FALLBACK_QUERIES.has(normalized);
}

function getMetadataValue(
  metadata: Json,
  key: string
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function parseVector(value: string | null) {
  if (!value?.startsWith("[") || !value.endsWith("]")) {
    return null;
  }

  const values = value
    .slice(1, -1)
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry));

  return values.length > 0 ? values : null;
}

function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length || left.length === 0) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function resolveCatalogHref(args: {
  sourceType: CatalogSourceType;
  metadata: Json;
  slug?: string | null;
}) {
  const metadataHref = getMetadataValue(args.metadata, "href");
  if (metadataHref) {
    return metadataHref;
  }

  if (args.sourceType === "product" && args.slug) {
    return ROUTES.product(args.slug);
  }

  return null;
}

function buildProductContextItem(
  hit: ProductSearchHit,
  locale: string
): RetrievedContextItem {
  const title = locale === "te" && hit.name_telugu ? hit.name_telugu : hit.name;
  const snippet =
    locale === "te" && hit.description_telugu
      ? hit.description_telugu
      : hit.description ?? hit.description_telugu ?? "";

  return {
    sourceType: "product",
    sourceKey: hit.sourceKey,
    title,
    snippet,
    locale: "multi",
    metadata: {
      slug: hit.slug,
      material: hit.material,
      tags: hit.tags,
      categorySlug: hit.category?.slug ?? null,
      href: ROUTES.product(hit.slug),
    },
    productId: hit.id,
    slug: hit.slug,
    href: ROUTES.product(hit.slug),
    score: hit.score,
    hit,
  };
}

function mapCatalogRowToContextItem(
  row: CatalogRetrievalDocumentRow,
  score: number
): RetrievedContextItem {
  const slug = getMetadataValue(row.metadata, "slug");
  const href = resolveCatalogHref({
    sourceType: row.source_type,
    metadata: row.metadata,
    slug,
  });

  return {
    sourceType: row.source_type,
    sourceKey: row.source_key,
    title: row.title,
    snippet: row.content,
    locale: row.locale,
    metadata: row.metadata,
    productId: row.product_id,
    slug,
    href,
    score,
  };
}

function applyStorefrontFilters<TQuery extends StorefrontFilterQuery<TQuery>>(
  baseQuery: TQuery,
  filters: ReturnType<typeof toFilters>,
  search?: string
) {
  let query = baseQuery;

  if (filters.categoryIds.length === 1) {
    query = query.eq("category_id", filters.categoryIds[0]);
  } else if (filters.categoryIds.length > 1) {
    query = query.in("category_id", filters.categoryIds);
  }

  if (filters.materials.length === 1) {
    query = query.eq("material", filters.materials[0]);
  } else if (filters.materials.length > 1) {
    query = query.in("material", filters.materials);
  }

  if (filters.tags.length > 0) {
    query = query.overlaps("tags", filters.tags);
  }

  if (filters.type === "sale") {
    query = query.eq("is_sale", true);
  } else if (filters.type === "rental") {
    query = query.eq("is_rental", true);
  }

  if (filters.type === "rental") {
    if (filters.minPrice > 0) {
      query = query.or(
        `and(rental_discount_price.not.is.null,rental_discount_price.gte.${filters.minPrice}),and(rental_discount_price.is.null,rental_price.gte.${filters.minPrice})`
      );
    }
    if (filters.maxPrice > 0) {
      query = query.or(
        `and(rental_discount_price.not.is.null,rental_discount_price.lte.${filters.maxPrice}),and(rental_discount_price.is.null,rental_price.lte.${filters.maxPrice})`
      );
    }
  } else if (filters.type === "sale") {
    if (filters.minPrice > 0) {
      query = query.or(
        `and(discount_price.not.is.null,discount_price.gte.${filters.minPrice}),and(discount_price.is.null,price.gte.${filters.minPrice})`
      );
    }
    if (filters.maxPrice > 0) {
      query = query.or(
        `and(discount_price.not.is.null,discount_price.lte.${filters.maxPrice}),and(discount_price.is.null,price.lte.${filters.maxPrice})`
      );
    }
  } else {
    if (filters.minPrice > 0) {
      query = query.or(
        `and(is_rental.eq.true,rental_discount_price.not.is.null,rental_discount_price.gte.${filters.minPrice}),and(is_rental.eq.true,rental_discount_price.is.null,rental_price.gte.${filters.minPrice}),and(is_rental.eq.false,discount_price.not.is.null,discount_price.gte.${filters.minPrice}),and(is_rental.eq.false,discount_price.is.null,price.gte.${filters.minPrice})`
      );
    }
    if (filters.maxPrice > 0) {
      query = query.or(
        `and(is_rental.eq.true,rental_discount_price.not.is.null,rental_discount_price.lte.${filters.maxPrice}),and(is_rental.eq.true,rental_discount_price.is.null,rental_price.lte.${filters.maxPrice}),and(is_rental.eq.false,discount_price.not.is.null,discount_price.lte.${filters.maxPrice}),and(is_rental.eq.false,discount_price.is.null,price.lte.${filters.maxPrice})`
      );
    }
  }

  if (search && !isGenericAssistantProductFallbackQuery(search)) {
    const safeSearch = escapeFallbackQueryValue(search);
    if (safeSearch) {
      query = query.or(
        `name.ilike.%${safeSearch}%,name_telugu.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%,description_telugu.ilike.%${safeSearch}%,slug.ilike.%${safeSearch}%`
      );
    }
  }

  return query;
}

function mapSearchRow(row: ProductRetrievalRow): ProductSearchHit {
  return {
    id: row.id,
    name: row.name,
    name_telugu: row.name_telugu,
    slug: row.slug,
    description: row.description,
    description_telugu: row.description_telugu,
    price: Number(row.price),
    discount_price: row.discount_price != null ? Number(row.discount_price) : null,
    category_id: row.category_id,
    stock: row.stock,
    material: row.material,
    tags: row.tags ?? [],
    images: row.images ?? [],
    is_active: row.is_active,
    featured: row.featured,
    is_sale: row.is_sale,
    is_rental: row.is_rental,
    rental_price: row.rental_price != null ? Number(row.rental_price) : null,
    rental_discount_price:
      row.rental_discount_price != null
        ? Number(row.rental_discount_price)
        : null,
    rental_deposit: row.rental_deposit != null ? Number(row.rental_deposit) : null,
    max_rental_days: row.max_rental_days,
    set_number: row.set_number,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category: row.category_name
      ? {
          name: row.category_name,
          name_telugu: row.category_name_telugu,
          slug: row.category_slug ?? "",
        }
      : null,
    sourceType: "product",
    sourceKey: row.source_key,
    retrievalStatus: row.index_status as RetrievalStatus,
    score: row.score ?? 0,
    keywordRank: row.keyword_rank,
    semanticRank: row.semantic_rank,
  };
}

function mapFallbackProduct(
  product: RetrievalProduct,
  keywordRank: number
): ProductSearchHit {
  return {
    id: product.id,
    name: product.name,
    name_telugu: product.name_telugu,
    slug: product.slug,
    description: product.description,
    description_telugu: product.description_telugu,
    price: Number(product.price),
    discount_price:
      product.discount_price != null ? Number(product.discount_price) : null,
    category_id: product.category_id,
    stock: product.stock,
    material: product.material,
    tags: product.tags ?? [],
    images: product.images ?? [],
    is_active: product.is_active,
    featured: product.featured,
    is_sale: product.is_sale,
    is_rental: product.is_rental,
    rental_price:
      product.rental_price != null ? Number(product.rental_price) : null,
    rental_discount_price:
      product.rental_discount_price != null
        ? Number(product.rental_discount_price)
        : null,
    rental_deposit:
      product.rental_deposit != null ? Number(product.rental_deposit) : null,
    max_rental_days: product.max_rental_days,
    set_number: product.set_number,
    created_at: product.created_at,
    updated_at: product.updated_at,
    category: product.category,
    sourceType: "product",
    sourceKey: `product:${product.id}`,
    retrievalStatus: "pending",
    score: 0,
    keywordRank,
    semanticRank: null,
  };
}

async function fallbackKeywordSearchProducts(args: {
  query: string;
  filters?: ProductSearchFilters;
  limit: number;
  offset: number;
}): Promise<ProductSearchResult> {
  const search = escapeFallbackQueryValue(args.query.trim());
  if (!search) {
    return {
      items: [],
      mode: "keyword",
      total: 0,
      hasMore: false,
      nextOffset: null,
    };
  }

  const admin = createAdminClient();
  const filters = toFilters(args.filters);
  const to = args.offset + args.limit;

  const query = applyStorefrontFilters(
    admin
      .from("products")
      .select(PRODUCT_RETRIEVAL_SELECT, { count: "exact" })
      .eq("is_active", true),
    filters,
    search
  )
    .order("featured", { ascending: false })
    .order("stock", { ascending: false })
    .order("updated_at", { ascending: false })
    .range(args.offset, to);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const products = (data ?? []) as RetrievalProduct[];
  const items = products
    .slice(0, args.limit)
    .map((product, index) => mapFallbackProduct(product, args.offset + index + 1));
  const total = count ?? items.length;
  const hasMore = total > args.offset + items.length;

  return {
    items,
    mode: "keyword",
    total,
    hasMore,
    nextOffset: hasMore ? args.offset + args.limit : null,
  };
}

async function searchProductRows(args: {
  query: string;
  filters?: ProductSearchFilters;
  limit: number;
  offset: number;
  mode?: RetrievalMode;
  queryEmbedding?: number[] | null;
}): Promise<ProductSearchResult> {
  const query = args.query.trim();
  if (query.length < 2) {
    return {
      items: [],
      mode: "keyword",
      total: 0,
      hasMore: false,
      nextOffset: null,
    };
  }

  const admin = createAdminClient();
  const filters = toFilters(args.filters);
  let resolvedMode: "keyword" | "hybrid" =
    args.mode === "keyword" || query.length < 4 ? "keyword" : "hybrid";
  let queryEmbeddingText: string | null = null;

  if (resolvedMode === "hybrid") {
    try {
      const embedding = args.queryEmbedding ?? await embedText(query, {
        taskType: "RETRIEVAL_QUERY",
      });
      queryEmbeddingText = serializeVector(embedding);
    } catch (error) {
      console.error("[searchProductRows] Query embedding failed:", error);
      resolvedMode = "keyword";
    }
  }

  try {
    const { data, error } = await admin.rpc("hybrid_search_products", {
      query_text: query,
      query_embedding_text: queryEmbeddingText,
      match_limit: args.limit + 1,
      match_offset: args.offset,
      category_ids: filters.categoryIds,
      materials: filters.materials,
      product_tags: filters.tags,
      product_type: filters.type,
      min_price: filters.minPrice,
      max_price: filters.maxPrice,
    });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as ProductRetrievalRow[];
    if (rows.length === 0) {
      return fallbackKeywordSearchProducts(args);
    }

    const total = rows[0]?.estimated_total ?? 0;
    const hasMore = rows.length > args.limit;

    return {
      items: rows.slice(0, args.limit).map(mapSearchRow),
      mode: resolvedMode,
      total,
      hasMore,
      nextOffset: hasMore ? args.offset + args.limit : null,
    };
  } catch (error) {
    console.error("[searchProductRows] Falling back to direct product search:", error);
    return fallbackKeywordSearchProducts(args);
  }
}

async function syncRetrievalDocument(
  admin: ReturnType<typeof createAdminClient>,
  document: RetrievalDocumentInput
) {
  const { data: existing, error: existingError } = await admin
    .from("catalog_retrieval_documents")
    .select("content_hash, index_status, embedding")
    .eq("source_key", document.sourceKey)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (
    existing?.content_hash === document.contentHash &&
    existing.index_status === "ready" &&
    existing.embedding
  ) {
    return "ready" as const;
  }

  const timestamp = new Date().toISOString();
  const priorEmbedding =
    existing?.content_hash === document.contentHash ? existing.embedding : null;

  const { error: upsertError } = await admin
    .from("catalog_retrieval_documents")
    .upsert(
      {
        source_type: document.sourceType,
        source_key: document.sourceKey,
        product_id: document.productId,
        locale: document.locale,
        title: document.title,
        content: document.content,
        metadata: document.metadata,
        content_hash: document.contentHash,
        index_status: "pending",
        last_indexed_at: null,
        last_index_error: null,
        updated_at: timestamp,
        embedding: priorEmbedding,
      },
      { onConflict: "source_key" }
    );

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  try {
    const embedding = await embedText(document.content, {
      taskType: "RETRIEVAL_DOCUMENT",
      title: document.title,
    });

    const { error: updateError } = await admin
      .from("catalog_retrieval_documents")
      .update({
        embedding: serializeVector(embedding),
        index_status: "ready",
        last_indexed_at: timestamp,
        last_index_error: null,
        updated_at: timestamp,
      })
      .eq("source_key", document.sourceKey);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return "ready" as const;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Embedding generation failed";

    await admin
      .from("catalog_retrieval_documents")
      .update({
        embedding: null,
        index_status: "failed",
        last_index_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("source_key", document.sourceKey);

    return "failed" as const;
  }
}

export function resolvePublicRetrievalLocales(locale: string) {
  return locale === "te" ? ["te", "en"] : ["en"];
}

/** Direct fetch of specific public documents (no search ranking involved) —
 *  used to guarantee baseline store context regardless of retrieval quality. */
export async function getPublicRetrievalDocumentsByKeys(
  sourceKeys: string[]
): Promise<RetrievedContextItem[]> {
  if (sourceKeys.length === 0) {
    return [];
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("catalog_retrieval_documents")
    .select("*")
    .in("source_key", sourceKeys)
    .neq("index_status", "pending");

  if (error) {
    console.error(
      "[getPublicRetrievalDocumentsByKeys] Failed to fetch seed documents:",
      error.message
    );
    return [];
  }

  return ((data ?? []) as CatalogRetrievalDocumentRow[]).map((row) =>
    mapCatalogRowToContextItem(row, 0)
  );
}

function getLocalePriority(candidateLocale: string, preferredLocale: string) {
  if (candidateLocale === preferredLocale) {
    return 2;
  }

  if (candidateLocale === "multi") {
    return 1;
  }

  return 0;
}

export async function searchPublicDocuments(args: {
  query: string;
  locale: string;
  sourceTypes: CatalogSourceType[];
  limit: number;
  offset: number;
  mode?: RetrievalMode;
  queryEmbedding?: number[] | null;
}): Promise<RetrievedCatalogContext> {
  const query = args.query.trim();
  if (query.length < 2 || args.sourceTypes.length === 0) {
    return {
      items: [],
      total: 0,
      hasMore: false,
      nextOffset: null,
      mode: "keyword",
    };
  }

  const admin = createAdminClient();
  const localeCandidates = resolvePublicRetrievalLocales(args.locale);

  try {
    const keywordPromise = admin
      .from("catalog_retrieval_documents")
      .select("*")
      .in("source_type", args.sourceTypes)
      .in("locale", localeCandidates)
      .neq("index_status", "pending")
      .textSearch("fts", query, { type: "websearch" })
      .range(0, 39);

    const semanticPromise = (async () => {
      if (args.mode === "keyword" || query.length < 4) {
        return [] as Array<{ row: CatalogRetrievalDocumentRow; similarity: number }>;
      }

      try {
        const queryEmbedding = args.queryEmbedding ?? await embedText(query, {
          taskType: "RETRIEVAL_QUERY",
        });

        const { data, error } = await admin
          .from("catalog_retrieval_documents")
          .select("*")
          .in("source_type", args.sourceTypes)
          .in("locale", localeCandidates)
          .eq("index_status", "ready")
          .not("embedding", "is", null);

        if (error) {
          throw error;
        }

        return ((data ?? []) as CatalogRetrievalDocumentRow[])
          .map((row) => {
            const embedding = parseVector(row.embedding);
            return embedding
              ? {
                  row,
                  similarity: cosineSimilarity(queryEmbedding, embedding),
                }
              : null;
          })
          .filter((entry): entry is { row: CatalogRetrievalDocumentRow; similarity: number } => Boolean(entry))
          .sort((left, right) => {
            if (right.similarity !== left.similarity) {
              return right.similarity - left.similarity;
            }

            return (
              getLocalePriority(right.row.locale, args.locale) -
              getLocalePriority(left.row.locale, args.locale)
            );
          })
          .slice(0, 20);
      } catch (error) {
        console.error(
          "[searchPublicDocuments] Semantic retrieval failed; using keyword-only public results:",
          error
        );
        return [] as Array<{ row: CatalogRetrievalDocumentRow; similarity: number }>;
      }
    })();

    const [{ data: keywordData, error: keywordError }, semanticRows] =
      await Promise.all([keywordPromise, semanticPromise]);

    if (keywordError) {
      throw keywordError;
    }

    const keywordRows = ((keywordData ?? []) as CatalogRetrievalDocumentRow[])
      .sort((left, right) => {
        const localeDelta =
          getLocalePriority(right.locale, args.locale) -
          getLocalePriority(left.locale, args.locale);
        if (localeDelta !== 0) {
          return localeDelta;
        }

        return left.source_key.localeCompare(right.source_key);
      })
      .slice(0, 20);

    const fused = new Map<string, {
      row: CatalogRetrievalDocumentRow;
      score: number;
      keywordRank: number | null;
      semanticRank: number | null;
      semanticSimilarity: number;
    }>();

    for (const [index, row] of keywordRows.entries()) {
      const existing = fused.get(row.source_key) ?? {
        row,
        score: 0,
        keywordRank: null as number | null,
        semanticRank: null as number | null,
        semanticSimilarity: 0,
      };

      existing.score += 1 / (60 + index + 1);
      existing.keywordRank = index + 1;
      fused.set(row.source_key, existing);
    }

    for (const [index, entry] of semanticRows.entries()) {
      const existing = fused.get(entry.row.source_key) ?? {
        row: entry.row,
        score: 0,
        keywordRank: null as number | null,
        semanticRank: null as number | null,
        semanticSimilarity: 0,
      };

      existing.score += 1 / (60 + index + 1) + entry.similarity / 100;
      existing.semanticRank = index + 1;
      existing.semanticSimilarity = entry.similarity;
      fused.set(entry.row.source_key, existing);
    }

    const ranked = [...fused.values()].sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const localeDelta =
        getLocalePriority(right.row.locale, args.locale) -
        getLocalePriority(left.row.locale, args.locale);
      if (localeDelta !== 0) {
        return localeDelta;
      }

      return right.semanticSimilarity - left.semanticSimilarity;
    });

    const total = ranked.length;
    const items = ranked
      .slice(args.offset, args.offset + args.limit)
      .map(({ row, score }) => mapCatalogRowToContextItem(row, score));
    const hasMore = total > args.offset + items.length;
    const mode =
      args.mode === "assistant"
        ? "assistant"
        : semanticRows.length > 0
          ? "hybrid"
          : "keyword";

    return {
      items,
      total,
      hasMore,
      nextOffset: hasMore ? args.offset + args.limit : null,
      mode,
    };
  } catch (error) {
    console.error("[searchPublicDocuments] Falling back to empty public context:", error);
    return {
      items: [],
      total: 0,
      hasMore: false,
      nextOffset: null,
      mode: "keyword",
    };
  }
}

export async function syncProductRetrievalDocument(productId: string) {
  const admin = createAdminClient();
  const product = await getProductForRetrieval(productId);

  if (!product || !product.is_active) {
    await removeProductRetrievalDocument(productId);
    return "ready" as const;
  }

  const document = buildProductRetrievalDocument(product);
  return syncRetrievalDocument(admin, document);
}

export async function removeProductRetrievalDocument(productId: string) {
  const admin = createAdminClient();
  await admin
    .from("catalog_retrieval_documents")
    .delete()
    .eq("source_key", `product:${productId}`);
}

export async function syncProductRetrievalDocuments(productIds: string[]) {
  const uniqueIds = [...new Set(productIds)].filter(Boolean);
  for (const productId of uniqueIds) {
    await syncProductRetrievalDocument(productId);
  }
}

export async function syncPublicRetrievalDocuments(locales?: string[]) {
  const resolvedLocales = (locales ?? [...PUBLIC_RETRIEVAL_LOCALES]).filter(
    (locale): locale is (typeof PUBLIC_RETRIEVAL_LOCALES)[number] =>
      PUBLIC_RETRIEVAL_LOCALES.includes(
        locale as (typeof PUBLIC_RETRIEVAL_LOCALES)[number]
      )
  );
  const admin = createAdminClient();
  const products = await getActiveProductsForPublicDocuments();
  const documents = buildPublicRetrievalDocuments(
    products,
    resolvedLocales.length > 0 ? resolvedLocales : PUBLIC_RETRIEVAL_LOCALES
  );
  const activeKeys = new Set(documents.map((document) => document.sourceKey));

  for (const document of documents) {
    await syncRetrievalDocument(admin, document);
  }

  const { data: existingRows, error: existingError } = await admin
    .from("catalog_retrieval_documents")
    .select("source_key")
    .in("source_type", PUBLIC_SOURCE_TYPES)
    .in("locale", resolvedLocales.length > 0 ? resolvedLocales : [...PUBLIC_RETRIEVAL_LOCALES]);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const staleKeys = (existingRows ?? [])
    .map((row) => row.source_key)
    .filter((sourceKey) => !activeKeys.has(sourceKey));

  if (staleKeys.length > 0) {
    await admin
      .from("catalog_retrieval_documents")
      .delete()
      .in("source_key", staleKeys);
  }
}

export async function ensurePublicRetrievalDocuments(locales?: string[]) {
  const resolvedLocales = (locales ?? [...PUBLIC_RETRIEVAL_LOCALES]).filter(
    (locale): locale is (typeof PUBLIC_RETRIEVAL_LOCALES)[number] =>
      PUBLIC_RETRIEVAL_LOCALES.includes(
        locale as (typeof PUBLIC_RETRIEVAL_LOCALES)[number]
      )
  );
  const targetLocales =
    resolvedLocales.length > 0 ? resolvedLocales : [...PUBLIC_RETRIEVAL_LOCALES];
  const products = await getActiveProductsForPublicDocuments();
  const expectedDocumentCount = buildPublicRetrievalDocuments(
    products,
    targetLocales
  ).length;
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("catalog_retrieval_documents")
    .select("id", { count: "exact", head: true })
    .in("source_type", PUBLIC_SOURCE_TYPES)
    .in("locale", targetLocales)
    .neq("index_status", "pending");

  if (error) {
    throw new Error(error.message);
  }

  if ((count ?? 0) < expectedDocumentCount) {
    await syncPublicRetrievalDocuments(targetLocales);
  }
}

export async function getCatalogRetrievalHealth(
  locales?: string[]
): Promise<CatalogRetrievalHealth> {
  const resolvedLocales = (locales ?? [...PUBLIC_RETRIEVAL_LOCALES]).filter(
    (locale): locale is (typeof PUBLIC_RETRIEVAL_LOCALES)[number] =>
      PUBLIC_RETRIEVAL_LOCALES.includes(
        locale as (typeof PUBLIC_RETRIEVAL_LOCALES)[number]
      )
  );
  const targetLocales =
    resolvedLocales.length > 0 ? resolvedLocales : [...PUBLIC_RETRIEVAL_LOCALES];
  const [products, admin] = await Promise.all([
    getActiveProductsForPublicDocuments(),
    Promise.resolve(createAdminClient()),
  ]);
  const expectedPublicDocumentCount = buildPublicRetrievalDocuments(
    products,
    targetLocales
  ).length;
  const [
    { count: indexedProductDocumentCount, error: productError },
    { count: indexedPublicDocumentCount, error: publicError },
    { count: failedDocumentCount, error: failedError },
  ] = await Promise.all([
    admin
      .from("catalog_retrieval_documents")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "product")
      .eq("index_status", "ready"),
    admin
      .from("catalog_retrieval_documents")
      .select("id", { count: "exact", head: true })
      .in("source_type", PUBLIC_SOURCE_TYPES)
      .in("locale", targetLocales)
      .eq("index_status", "ready"),
    admin
      .from("catalog_retrieval_documents")
      .select("id", { count: "exact", head: true })
      .eq("index_status", "failed"),
  ]);

  if (productError) {
    throw new Error(productError.message);
  }

  if (publicError) {
    throw new Error(publicError.message);
  }

  if (failedError) {
    throw new Error(failedError.message);
  }

  return {
    activeProductCount: products.length,
    indexedProductDocumentCount: indexedProductDocumentCount ?? 0,
    indexedPublicDocumentCount: indexedPublicDocumentCount ?? 0,
    failedDocumentCount: failedDocumentCount ?? 0,
    expectedPublicDocumentCount,
  };
}

export async function retrieveCatalogContext(args: {
  query: string;
  locale: string;
  filters?: ProductSearchFilters;
  limit?: number;
  offset?: number;
  sourceTypes?: CatalogSourceType[];
  mode?: RetrievalMode;
  signal?: AbortSignal;
  /** Voice turn: skip the embedding retry so a slow Gemini cannot eat the
   *  realtime budget. Hybrid search degrades to FTS, which is the right
   *  trade when the alternative is the customer hearing nothing. */
  singleAttemptEmbedding?: boolean;
}): Promise<RetrievedCatalogContext> {
  const sourceTypes = args.sourceTypes ?? ["product"];
  const limit = args.limit ?? 12;
  const offset = args.offset ?? 0;
  const query = args.query.trim();

  if (query.length < 2) {
    return {
      items: [],
      total: 0,
      hasMore: false,
      nextOffset: null,
      mode: "keyword",
    };
  }

  if (sourceTypes.length === 1 && sourceTypes[0] === "product") {
    const result = await searchProductRows({
      query,
      filters: args.filters,
      limit,
      offset,
      mode: args.mode,
    });

    return {
      items: result.items.map((hit) => buildProductContextItem(hit, args.locale)),
      total: result.total,
      hasMore: result.hasMore,
      nextOffset: result.nextOffset,
      mode: result.mode,
    };
  }

  const includeProducts = sourceTypes.includes("product");
  const publicSourceTypes = sourceTypes.filter(
    (sourceType): sourceType is Exclude<CatalogSourceType, "product"> =>
      sourceType !== "product"
  );

  if (!includeProducts) {
    return searchPublicDocuments({
      query,
      locale: args.locale,
      sourceTypes: publicSourceTypes,
      limit,
      offset,
      mode: args.mode,
    });
  }

  let queryEmbedding: number[] | null = null;
  if (args.mode !== "keyword" && query.length >= 4) {
    try {
      queryEmbedding = await embedText(query, {
        taskType: "RETRIEVAL_QUERY",
        signal: args.signal,
        singleAttempt: args.singleAttemptEmbedding,
      });
    } catch (error) {
      console.error("[retrieveCatalogContext] Query embedding failed:", error);
    }
  }

  const expandedLimit = Math.max(limit * 2, 12);
  const [productResult, publicResult] = await Promise.all([
    searchProductRows({
      query,
      filters: args.filters,
      limit: expandedLimit,
      offset: 0,
      mode: queryEmbedding ? args.mode : "keyword",
      queryEmbedding,
    }),
    searchPublicDocuments({
      query,
      locale: args.locale,
      sourceTypes: publicSourceTypes,
      limit: expandedLimit,
      offset: 0,
      mode: queryEmbedding ? args.mode : "keyword",
      queryEmbedding,
    }),
  ]);

  const combined = [
    ...productResult.items.map((hit) => buildProductContextItem(hit, args.locale)),
    ...publicResult.items,
  ].sort((left, right) => {
    const scoreDelta = (right.score ?? 0) - (left.score ?? 0);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const sourceDelta = Number(right.sourceType === "product") -
      Number(left.sourceType === "product");
    if (sourceDelta !== 0) {
      return sourceDelta;
    }

    return left.sourceKey.localeCompare(right.sourceKey);
  });

  const pagedItems = combined.slice(offset, offset + limit);
  const total = combined.length;
  const hasMore = total > offset + pagedItems.length;

  return {
    items: pagedItems,
    total,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
    mode:
      args.mode === "assistant"
        ? "assistant"
        : queryEmbedding
          ? "hybrid"
          : "keyword",
  };
}

export async function searchProducts(args: {
  query: string;
  locale: string;
  filters?: ProductSearchFilters;
  limit?: number;
  offset?: number;
  mode?: RetrievalMode;
}): Promise<CatalogSearchResponse> {
  const context = await retrieveCatalogContext({
    query: args.query,
    locale: args.locale,
    filters: args.filters,
    limit: args.limit,
    offset: args.offset,
    sourceTypes: ["product"],
    mode: args.mode,
  });

  return {
    items: context.items
      .map((item) => item.hit)
      .filter((item): item is ProductSearchHit => Boolean(item)),
    total: context.total,
    hasMore: context.hasMore,
    nextOffset: context.nextOffset,
    mode: context.mode === "assistant" ? "hybrid" : context.mode,
  };
}
