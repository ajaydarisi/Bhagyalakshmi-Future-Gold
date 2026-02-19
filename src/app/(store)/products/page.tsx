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
import { PRODUCTS_PER_PAGE, CATEGORIES } from "@/lib/constants";
import type { ProductWithCategory, SortOption } from "@/types/product";
import { Search } from "lucide-react";

interface ProductsPageProps {
  searchParams: Promise<{
    category?: string;
    material?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    page?: string;
  }>;
}

export async function generateMetadata({
  searchParams,
}: ProductsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const category = CATEGORIES.find((c) => c.slug === params.category);
  const title = category ? `${category.name} - Products` : "All Products";
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

  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select("*, category:categories(name, slug)", { count: "exact" })
    .eq("is_active", true);

  if (category) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", category)
      .single();
    if (cat) {
      query = query.eq("category_id", cat.id);
    }
  }

  if (material) {
    query = query.eq("material", material);
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
  const categoryName = CATEGORIES.find((c) => c.slug === category)?.name;

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "Products", href: categoryName ? "/products" : undefined },
          ...(categoryName ? [{ label: categoryName }] : []),
        ]}
      />

      <div className="mt-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">
            {categoryName || "All Products"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {count || 0} product{count !== 1 ? "s" : ""} found
          </p>
        </div>
        <Suspense>
          <ProductSort />
        </Suspense>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[250px_1fr]">
        {/* Sidebar Filters */}
        <aside className="hidden lg:block">
          <Suspense>
            <ProductFilters />
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
