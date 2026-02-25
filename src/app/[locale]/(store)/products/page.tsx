import { Suspense } from "react";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductGrid } from "@/components/products/product-grid";
import { ProductFilters } from "@/components/products/product-filters";
import { ProductSort } from "@/components/products/product-sort";
import { Pagination } from "@/components/shared/pagination";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { EmptyState } from "@/components/shared/empty-state";
import { ProductGridSkeleton } from "@/components/shared/loading-skeleton";
import { APP_NAME, PRODUCTS_PER_PAGE } from "@/lib/constants";
import type { ProductWithCategory, SortOption } from "@/types/product";
import { MobileFilterSheet } from "@/components/products/mobile-filter-sheet";
import { FilterLoadingProvider } from "@/components/products/filter-loading-context";
import { ProductsHeading } from "@/components/products/products-heading";
import { Search } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { unstable_cache } from "next/cache";

interface ProductsPageProps {
  searchParams: Promise<{
    category?: string;
    material?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    page?: string;
    type?: string;
  }>;
}

const PRODUCT_LIST_FIELDS =
  "id, name, name_telugu, slug, price, discount_price, images, tags, stock, is_sale, is_rental, rental_price, material, category:categories(name, name_telugu, slug)";

const getAllCategories = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order");
    return data ?? [];
  },
  ["all-categories"],
  { revalidate: 300 }
);

const getProductCount = unstable_cache(
  async (
    categoryIds: string[],
    materials: string[],
    type: string,
    minPrice: number,
    maxPrice: number
  ) => {
    const supabase = createAdminClient();

    let query = supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    if (categoryIds.length === 1) {
      query = query.eq("category_id", categoryIds[0]);
    } else if (categoryIds.length > 1) {
      query = query.in("category_id", categoryIds);
    }

    if (materials.length === 1) query = query.eq("material", materials[0]);
    else if (materials.length > 1) query = query.in("material", materials);
    if (type === "sale") query = query.eq("is_sale", true);
    else if (type === "rental") query = query.eq("is_rental", true);
    if (minPrice > 0) query = query.gte("price", minPrice);
    if (maxPrice > 0) query = query.lte("price", maxPrice);

    const { count } = await query;
    return count;
  },
  ["product-count"],
  { revalidate: 60 }
);

const getFilteredProducts = unstable_cache(
  async (
    categoryIds: string[],
    materials: string[],
    type: string,
    minPrice: number,
    maxPrice: number,
    sort: string,
    page: number,
    locale: string
  ) => {
    const supabase = createAdminClient();

    let query = supabase
      .from("products")
      .select(PRODUCT_LIST_FIELDS)
      .eq("is_active", true);

    if (categoryIds.length === 1) {
      query = query.eq("category_id", categoryIds[0]);
    } else if (categoryIds.length > 1) {
      query = query.in("category_id", categoryIds);
    }

    if (materials.length === 1) query = query.eq("material", materials[0]);
    else if (materials.length > 1) query = query.in("material", materials);
    if (type === "sale") query = query.eq("is_sale", true);
    else if (type === "rental") query = query.eq("is_rental", true);
    if (minPrice > 0) query = query.gte("price", minPrice);
    if (maxPrice > 0) query = query.lte("price", maxPrice);

    switch (sort) {
      case "price-asc":
        query = query.order("price", { ascending: true });
        break;
      case "price-desc":
        query = query.order("price", { ascending: false });
        break;
      case "name-asc":
        query = query.order(locale === "te" ? "name_telugu" : "name", { ascending: true });
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

    const from = (page - 1) * PRODUCTS_PER_PAGE;
    const to = from + PRODUCTS_PER_PAGE - 1;
    query = query.range(from, to);

    const { data } = await query;
    return data;
  },
  ["filtered-products"],
  { revalidate: 60 }
);

export async function generateMetadata({
  searchParams,
}: ProductsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const t = await getTranslations("products.listing");
  let title = t("allProducts");
  if (params.category) {
    const categorySlugs = params.category.split(",").filter(Boolean);
    const categories = await getAllCategories();
    const names = categorySlugs
      .map((slug) => categories.find((c) => c.slug === slug)?.name)
      .filter(Boolean);
    if (names.length > 0) title = `${names.join(", ")} - ${t("metaProductsSuffix")}`;
  }
  if (params.type === "rental") title = `${t("forRent")} - ${title}`;
  const description = `${t("metaDescription", { brand: APP_NAME })}`;
  return { title, description };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const categorySlugs = params.category ? params.category.split(",").filter(Boolean) : [];
  const materials = params.material ? params.material.split(",").filter(Boolean) : [];
  const minPrice = Number(params.minPrice) || 0;
  const maxPrice = Number(params.maxPrice) || 0;
  const sort = (params.sort as SortOption) || "newest";
  const page = Number(params.page) || 1;
  const type = params.type || "";

  const locale = await getLocale();
  const t = await getTranslations("products.listing");
  const tRoot = await getTranslations();

  // Fetch categories (cached)
  const categoriesList = await getAllCategories();

  // Resolve category IDs — for each selected slug, include all children
  const categoryIds: string[] = [];
  for (const slug of categorySlugs) {
    const cat = categoriesList.find((c) => c.slug === slug);
    if (cat) {
      categoryIds.push(cat.id);
      const children = categoriesList.filter((c) => c.parent_id === cat.id);
      for (const child of children) {
        categoryIds.push(child.id);
        const grandchildren = categoriesList.filter((c) => c.parent_id === child.id);
        for (const gc of grandchildren) {
          categoryIds.push(gc.id);
        }
      }
    }
  }

  // Fetch products and count in parallel (both independently cached)
  const [products, count] = await Promise.all([
    getFilteredProducts(categoryIds, materials, type, minPrice, maxPrice, sort, page, locale),
    getProductCount(categoryIds, materials, type, minPrice, maxPrice),
  ]);

  const totalPages = Math.ceil((count || 0) / PRODUCTS_PER_PAGE);

  const headingTitle = `${t("allProducts")}${type === "rental" ? ` — ${t("forRent")}` : ""}${type === "sale" ? ` — ${t("forSale")}` : ""}`;

  return (
    <FilterLoadingProvider>
      <div className="container mx-auto px-4 py-8">
        <Breadcrumbs
          homeLabel={tRoot("breadcrumbHome")}
          items={[
            { label: t("breadcrumb") },
          ]}
        />

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Suspense>
            <ProductsHeading
              title={headingTitle}
              count={count || 0}
              countLabel={t("productCount", { count: count || 0 })}
            />
          </Suspense>
          <div className="flex items-center gap-2">
            <Suspense>
              <MobileFilterSheet categories={categoriesList} />
            </Suspense>
            <Suspense>
              <ProductSort />
            </Suspense>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[250px_1fr]">
          {/* Sidebar Filters */}
          <aside className="hidden lg:block">
            <Suspense>
              <ProductFilters categories={categoriesList} />
            </Suspense>
          </aside>

          {/* Product Grid */}
          <div>
            <Suspense fallback={<ProductGridSkeleton />}>
              {products && products.length > 0 ? (
                <>
                  <ProductGrid
                    products={products as unknown as ProductWithCategory[]}
                  />
                  <div className="mt-8">
                    <Suspense>
                      <Pagination currentPage={page} totalPages={totalPages} />
                    </Suspense>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={<Search className="h-16 w-16" />}
                  title={t("noProducts")}
                  description={t("noProductsDesc")}
                  actionLabel={t("clearFilters")}
                  actionHref="/products"
                />
              )}
            </Suspense>
          </div>
        </div>
      </div>
    </FilterLoadingProvider>
  );
}
