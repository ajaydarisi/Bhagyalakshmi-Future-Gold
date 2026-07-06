import { createClient } from "@/lib/supabase/client";
import { PRODUCTS_PER_PAGE } from "@/lib/constants";
import { calculateDiscount } from "@/lib/formatters";
import {
  getOfflineFeaturedProducts,
  getOfflineNewProducts,
  getOfflinePagedProducts,
  getOfflineProductBySlug,
  getOfflineProductCount,
  getOfflineRelatedProducts,
  isOfflineE2EFixtureMode,
} from "@/lib/offline-store-fixtures";
import type { ProductWithCategory } from "@/types/product";
import type { CatalogSearchResponse } from "@/types/search";

export const PRODUCT_LIST_FIELDS =
  "id, name, name_telugu, slug, price, discount_price, images, tags, stock, is_sale, is_rental, rental_price, rental_discount_price, max_rental_days, material, set_number, category:categories(name, name_telugu, slug)";

export interface FetchProductsParams {
  categoryIds: string[];
  materials: string[];
  tags: string[];
  type: string;
  minPrice: number;
  maxPrice: number;
  sort: string;
  page?: number;
  locale: string;
  search: string;
}

export interface FetchProductsResponse {
  products: ProductWithCategory[];
  count: number;
  hasMore?: boolean;
  nextOffset?: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, params: FetchProductsParams) {
  const { categoryIds, materials, tags, type, minPrice, maxPrice, search } =
    params;

  if (categoryIds.length === 1) {
    query = query.eq("category_id", categoryIds[0]);
  } else if (categoryIds.length > 1) {
    query = query.in("category_id", categoryIds);
  }

  if (materials.length === 1) query = query.eq("material", materials[0]);
  else if (materials.length > 1) query = query.in("material", materials);
  if (tags.length > 0) query = query.overlaps("tags", tags);
  if (type === "sale") query = query.eq("is_sale", true);
  else if (type === "rental") query = query.eq("is_rental", true);
  if (type === "rental") {
    if (minPrice > 0)
      query = query.or(
        `and(rental_discount_price.not.is.null,rental_discount_price.gte.${minPrice}),and(rental_discount_price.is.null,rental_price.gte.${minPrice})`
      );
    if (maxPrice > 0)
      query = query.or(
        `and(rental_discount_price.not.is.null,rental_discount_price.lte.${maxPrice}),and(rental_discount_price.is.null,rental_price.lte.${maxPrice})`
      );
  } else if (type === "sale") {
    if (minPrice > 0)
      query = query.or(
        `and(discount_price.not.is.null,discount_price.gte.${minPrice}),and(discount_price.is.null,price.gte.${minPrice})`
      );
    if (maxPrice > 0)
      query = query.or(
        `and(discount_price.not.is.null,discount_price.lte.${maxPrice}),and(discount_price.is.null,price.lte.${maxPrice})`
      );
  } else {
    if (minPrice > 0) {
      query = query.or(
        `and(is_rental.eq.true,rental_discount_price.not.is.null,rental_discount_price.gte.${minPrice}),and(is_rental.eq.true,rental_discount_price.is.null,rental_price.gte.${minPrice}),and(is_rental.eq.false,discount_price.not.is.null,discount_price.gte.${minPrice}),and(is_rental.eq.false,discount_price.is.null,price.gte.${minPrice})`
      );
    }
    if (maxPrice > 0) {
      query = query.or(
        `and(is_rental.eq.true,rental_discount_price.not.is.null,rental_discount_price.lte.${maxPrice}),and(is_rental.eq.true,rental_discount_price.is.null,rental_price.lte.${maxPrice}),and(is_rental.eq.false,discount_price.not.is.null,discount_price.lte.${maxPrice}),and(is_rental.eq.false,discount_price.is.null,price.lte.${maxPrice})`
      );
    }
  }
  if (search) {
    query = query.or(`name.ilike.%${search}%,name_telugu.ilike.%${search}%`);
  }

  return query;
}

export async function fetchProducts(
  params: FetchProductsParams
): Promise<FetchProductsResponse> {
  if (isOfflineE2EFixtureMode()) {
    const products = getOfflinePagedProducts(params);
    const count = getOfflineProductCount(params);
    const page = params.page ?? 1;

    return {
      products,
      count,
      hasMore: page * PRODUCTS_PER_PAGE < count,
      nextOffset:
        page * PRODUCTS_PER_PAGE < count ? page * PRODUCTS_PER_PAGE : null,
    };
  }

  if (params.search) {
    const page = params.page ?? 1;
    const offset = (page - 1) * PRODUCTS_PER_PAGE;
    const searchParams = new URLSearchParams({
      q: params.search,
      locale: params.locale,
      limit: String(PRODUCTS_PER_PAGE),
      offset: String(offset),
    });

    if (params.categoryIds.length > 0) {
      searchParams.set("categoryIds", params.categoryIds.join(","));
    }
    if (params.materials.length > 0) {
      searchParams.set("materials", params.materials.join(","));
    }
    if (params.tags.length > 0) {
      searchParams.set("tags", params.tags.join(","));
    }
    if (params.type) {
      searchParams.set("type", params.type);
    }
    if (params.minPrice > 0) {
      searchParams.set("minPrice", String(params.minPrice));
    }
    if (params.maxPrice > 0) {
      searchParams.set("maxPrice", String(params.maxPrice));
    }

    const response = await fetch(`/api/search/products?${searchParams.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Semantic product search failed");
    }

    const data = (await response.json()) as CatalogSearchResponse;
    return {
      products: data.items,
      count: data.total,
      hasMore: data.hasMore,
      nextOffset: data.nextOffset,
    };
  }

  const supabase = createClient();
  const { sort, page = 1, locale } = params;

  const countQuery = applyFilters(
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    params
  );

  let query = applyFilters(
    supabase.from("products").select(PRODUCT_LIST_FIELDS).eq("is_active", true),
    params
  );

  // Sorting
  const isDiscountSort = sort === "discount";
  const isPriceSort = sort === "price-asc" || sort === "price-desc";

  switch (sort) {
    case "price-asc":
    case "price-desc":
      // Sort in-app by effective displayed price (considers discounts)
      break;
    case "name-asc":
      query = query.order(locale === "te" ? "name_telugu" : "name", {
        ascending: true,
      });
      break;
    case "discount":
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const from = (page - 1) * PRODUCTS_PER_PAGE;
  const to = from + PRODUCTS_PER_PAGE - 1;

  if (!isDiscountSort && !isPriceSort) {
    query = query.range(from, to);
  }

  const [{ data: products }, { count }] = await Promise.all([
    query,
    countQuery,
  ]);

  let result = (products ?? []) as unknown as ProductWithCategory[];

  if (isPriceSort && products) {
    const getEffectivePrice = (p: ProductWithCategory) => {
      if (p.is_rental && p.rental_price) {
        return p.rental_discount_price ?? p.rental_price;
      }
      return p.discount_price ?? p.price;
    };
    const asc = sort === "price-asc";
    result.sort((a, b) => asc
      ? getEffectivePrice(a) - getEffectivePrice(b)
      : getEffectivePrice(b) - getEffectivePrice(a)
    );
    result = result.slice(from, to + 1);
  }

  if (isDiscountSort && products) {
    const getDiscountPct = (p: ProductWithCategory) => {
      if (p.is_sale) {
        return calculateDiscount(p.price, p.discount_price) ?? -1;
      }
      if (p.is_rental && p.rental_price) {
        return (
          calculateDiscount(p.rental_price, p.rental_discount_price) ?? -1
        );
      }
      return calculateDiscount(p.price, p.discount_price) ?? -1;
    };
    result.sort((a, b) => getDiscountPct(b) - getDiscountPct(a));
    result = result.slice(from, to + 1);
  }

  return { products: result, count: count ?? 0 };
}

export async function fetchProduct(
  slug: string
): Promise<ProductWithCategory | null> {
  if (isOfflineE2EFixtureMode()) {
    return getOfflineProductBySlug(slug);
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select("*, category:categories(name, name_telugu, slug)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  return (data as unknown as ProductWithCategory) ?? null;
}

export async function fetchRelatedProducts(
  categoryId: string,
  excludeId: string
): Promise<ProductWithCategory[]> {
  if (isOfflineE2EFixtureMode()) {
    return getOfflineRelatedProducts(categoryId, excludeId);
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_LIST_FIELDS)
    .eq("is_active", true)
    .eq("category_id", categoryId)
    .neq("id", excludeId)
    .limit(4);
  return (data ?? []) as unknown as ProductWithCategory[];
}

export async function fetchFeaturedProducts(): Promise<ProductWithCategory[]> {
  if (isOfflineE2EFixtureMode()) {
    return getOfflineFeaturedProducts();
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_LIST_FIELDS)
    .eq("is_active", true)
    .eq("featured", true)
    .limit(8);
  return (data ?? []) as unknown as ProductWithCategory[];
}

export async function fetchNewProducts(): Promise<ProductWithCategory[]> {
  if (isOfflineE2EFixtureMode()) {
    return getOfflineNewProducts();
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_LIST_FIELDS)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(4);
  return (data ?? []) as unknown as ProductWithCategory[];
}

export async function fetchWishlistProducts(
  userId: string
): Promise<ProductWithCategory[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("wishlist_items")
    .select(`product_id, product:products(${PRODUCT_LIST_FIELDS})`)
    .eq("user_id", userId);

  return (data || [])
    .map((item: { product_id: string; product: unknown }) => item.product)
    .filter(Boolean) as unknown as ProductWithCategory[];
}
