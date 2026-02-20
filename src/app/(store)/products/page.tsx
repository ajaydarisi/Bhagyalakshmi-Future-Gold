import { Suspense } from "react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ProductGrid } from "@/components/products/product-grid";
import { ProductFilters } from "@/components/products/product-filters";
import { ProductSort } from "@/components/products/product-sort";
import { Pagination } from "@/components/shared/pagination";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { EmptyState } from "@/components/shared/empty-state";
import { ProductGridSkeleton } from "@/components/shared/loading-skeleton";
import { PRODUCTS_PER_PAGE } from "@/lib/constants";
import type { ProductWithCategory, SortOption } from "@/types/product";
import { MobileFilterSheet } from "@/components/products/mobile-filter-sheet";
import { Search } from "lucide-react";

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

export async function generateMetadata({
  searchParams,
}: ProductsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const supabase = await createClient();
  let title = "All Products";
  if (params.category) {
    const { data: cat } = await supabase
      .from("categories")
      .select("name")
      .eq("slug", params.category)
      .single();
    if (cat) title = `${cat.name} - Products`;
  }
  if (params.type === "rental") title = `Rental - ${title}`;
  return { title };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const category = params.category || "";
  const material = params.material || "";
  const minPrice = Number(params.minPrice) || 0;
  const maxPrice = Number(params.maxPrice) || 0;
  const sort = (params.sort as SortOption) || "newest";
  const page = Number(params.page) || 1;
  const type = params.type || "";

  const supabase = await createClient();

  // Fetch all categories for filters
  const { data: allCategories } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order");

  const categoriesList = allCategories ?? [];

  // Resolve category IDs — if a parent category is selected, include all children
  let categoryIds: string[] = [];
  let categoryName = "";
  if (category) {
    const cat = categoriesList.find((c) => c.slug === category);
    if (cat) {
      categoryName = cat.name;
      // Collect this category and all its descendants
      categoryIds = [cat.id];
      const children = categoriesList.filter((c) => c.parent_id === cat.id);
      for (const child of children) {
        categoryIds.push(child.id);
        // Also include grandchildren
        const grandchildren = categoriesList.filter((c) => c.parent_id === child.id);
        for (const gc of grandchildren) {
          categoryIds.push(gc.id);
        }
      }
    }
  }

  let query = supabase
    .from("products")
    .select("*, category:categories(name, slug)", { count: "exact" })
    .eq("is_active", true);

  if (categoryIds.length === 1) {
    query = query.eq("category_id", categoryIds[0]);
  } else if (categoryIds.length > 1) {
    query = query.in("category_id", categoryIds);
  }

  if (material) {
    query = query.eq("material", material);
  }

  if (type === "sale") {
    query = query.eq("is_sale", true);
  } else if (type === "rental") {
    query = query.eq("is_rental", true);
  }

  if (minPrice > 0) {
    query = query.gte("price", minPrice);
  }

  if (maxPrice > 0) {
    query = query.lte("price", maxPrice);
  }

  switch (sort) {
    case "price-asc":
      query = query.order("price", { ascending: true });
      break;
    case "price-desc":
      query = query.order("price", { ascending: false });
      break;
    case "name-asc":
      query = query.order("name", { ascending: true });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const from = (page - 1) * PRODUCTS_PER_PAGE;
  const to = from + PRODUCTS_PER_PAGE - 1;
  query = query.range(from, to);

  const { data: products, count } = await query;

  const totalPages = Math.ceil((count || 0) / PRODUCTS_PER_PAGE);

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "Products", href: categoryName ? "/products" : undefined },
          ...(categoryName ? [{ label: categoryName }] : []),
        ]}
      />

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">
            {categoryName || "All Products"}
            {type === "rental" && " — For Rent"}
            {type === "sale" && " — For Sale"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {count || 0} product{count !== 1 ? "s" : ""} found
          </p>
        </div>
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
                title="No products found"
                description="Try adjusting your filters or search criteria"
                actionLabel="Clear Filters"
                actionHref="/products"
              />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
