import { createHash } from "node:crypto";
import { embedText, serializeVector } from "@/lib/ai/gemini";
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

function buildProductRetrievalDocument(product: RetrievalProduct) {
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
    sourceKey: `product:${product.id}`,
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

  if (search) {
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
}): Promise<ProductSearchResult> {
  const query = args.query.trim();
  if (query.length < 2) {
    return {
      items: [],
      mode: "keyword" as const,
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
      const embedding = await embedText(query, {
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

export async function syncProductRetrievalDocument(productId: string) {
  const admin = createAdminClient();
  const product = await getProductForRetrieval(productId);

  if (!product || !product.is_active) {
    await removeProductRetrievalDocument(productId);
    return "ready" as const;
  }

  const document = buildProductRetrievalDocument(product);
  const { data: existing } = await admin
    .from("catalog_retrieval_documents")
    .select("content_hash, index_status, embedding")
    .eq("source_key", document.sourceKey)
    .maybeSingle();

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
        source_type: "product",
        source_key: document.sourceKey,
        product_id: product.id,
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

export async function retrieveCatalogContext(args: {
  query: string;
  locale: string;
  filters?: ProductSearchFilters;
  limit?: number;
  offset?: number;
  sourceTypes?: CatalogSourceType[];
  mode?: RetrievalMode;
}): Promise<RetrievedCatalogContext> {
  const sourceTypes = args.sourceTypes ?? ["product"];
  const limit = args.limit ?? 12;
  const offset = args.offset ?? 0;

  if (sourceTypes.length === 1 && sourceTypes[0] === "product") {
    const result = await searchProductRows({
      query: args.query,
      filters: args.filters,
      limit,
      offset,
      mode: args.mode,
    });

    return {
      items: result.items.map((hit) => {
        return {
          sourceType: "product" as const,
          sourceKey: hit.sourceKey,
          title: hit.name,
          snippet: hit.description ?? hit.description_telugu ?? "",
          locale: "multi",
          metadata: {
            slug: hit.slug,
            material: hit.material,
            tags: hit.tags,
            categorySlug: hit.category?.slug ?? null,
          },
          productId: hit.id,
          slug: hit.slug,
          hit,
        } satisfies RetrievedContextItem;
      }),
      total: result.total,
      hasMore: result.hasMore,
      nextOffset: result.nextOffset,
      mode: result.mode,
    };
  }

  const admin = createAdminClient();
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

  const { data, error } = await admin
    .from("catalog_retrieval_documents")
    .select("*")
    .in("source_type", sourceTypes)
    .neq("index_status", "pending")
    .textSearch("fts", query, { type: "websearch" })
    .range(offset, offset + limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Database["public"]["Tables"]["catalog_retrieval_documents"]["Row"][];
  const hasMore = rows.length > limit;

  return {
    items: rows.slice(0, limit).map((row) => ({
      sourceType: row.source_type,
      sourceKey: row.source_key,
      title: row.title,
      snippet: row.content,
      locale: row.locale,
      metadata: row.metadata,
      productId: row.product_id,
    })),
    total: rows.length,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
    mode: "keyword",
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
