import { createClient } from "@/lib/supabase/client";
import { PRODUCTS_PER_PAGE } from "@/lib/constants";
import { calculateDiscount } from "@/lib/formatters";
import type { ProductWithCategory } from "@/types/product";

const PRODUCT_LIST_FIELDS =
  "id, name, name_telugu, slug, price, discount_price, images, tags, stock, is_sale, is_rental, rental_price, rental_discount_price, material, set_number, category:categories(name, name_telugu, slug)";

export interface FetchProductsParams {
  categoryIds: string[];
  materials: string[];
  tags: string[];
  type: string;
  minPrice: number;
  maxPrice: number;
  sort: string;
  page: number;
  locale: string;
  search: string;
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
    if (minPrice > 0) query = query.gte("rental_price", minPrice);
    if (maxPrice > 0) query = query.lte("rental_price", maxPrice);
  } else if (type === "sale") {
    if (minPrice > 0) query = query.gte("price", minPrice);
    if (maxPrice > 0) query = query.lte("price", maxPrice);
  } else {
    if (minPrice > 0) {
      query = query.or(
        `and(is_rental.eq.true,rental_price.gte.${minPrice}),and(is_rental.eq.false,price.gte.${minPrice})`
      );
    }
    if (maxPrice > 0) {
      query = query.or(
        `and(is_rental.eq.true,rental_price.lte.${maxPrice}),and(is_rental.eq.false,price.lte.${maxPrice})`
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
): Promise<{ products: ProductWithCategory[]; count: number }> {
  const supabase = createClient();
  const { type, sort, page, locale } = params;

  let countQuery = applyFilters(
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
  const priceCol = type === "rental" ? "rental_price" : "price";
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
  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select("*, category:categories(name, name_telugu, slug)")
    .eq("is_active", true)
    .eq("featured", true)
    .limit(8);
  return (data ?? []) as unknown as ProductWithCategory[];
}

export async function fetchNewProducts(): Promise<ProductWithCategory[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select("*, category:categories(name, name_telugu, slug)")
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
    .select(
      "product_id, product:products(*, category:categories(name, name_telugu, slug))"
    )
    .eq("user_id", userId);

  return (data || [])
    .map((item: { product_id: string; product: unknown }) => item.product)
    .filter(Boolean) as unknown as ProductWithCategory[];
}
