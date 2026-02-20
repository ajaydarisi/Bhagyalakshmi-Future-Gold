import { ProductGrid } from "@/components/products/product-grid";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { PRODUCTS_PER_PAGE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { ProductWithCategory } from "@/types/product";
import { Search } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const params = await searchParams;
  const t = await getTranslations("search");
  return {
    title: params.q ? t("metaTitle", { query: params.q }) : t("title"),
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q || "";
  const page = Number(params.page) || 1;
  const t = await getTranslations("search");

  const supabase = await createClient();

  let products: ProductWithCategory[] = [];
  let count = 0;

  if (query) {
    const from = (page - 1) * PRODUCTS_PER_PAGE;
    const to = from + PRODUCTS_PER_PAGE - 1;

    const { data, count: totalCount } = await supabase
      .from("products")
      .select("*, category:categories(name, name_telugu, slug)", { count: "exact" })
      .eq("is_active", true)
      .textSearch("fts", query, { type: "websearch" })
      .range(from, to);

    products = (data as unknown as ProductWithCategory[]) || [];
    count = totalCount || 0;
  }

  const totalPages = Math.ceil(count / PRODUCTS_PER_PAGE);

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={[{ label: t("breadcrumb") }]} />

      <div className="mt-6">
        <h1 className="text-2xl font-bold md:text-3xl">
          {query ? t("resultsFor", { query }) : t("title")}
        </h1>
        {query && (
          <p className="text-sm text-muted-foreground">
            {t("resultCount", { count })}
          </p>
        )}
      </div>

      <div className="mt-8">
        {products.length > 0 ? (
          <>
            <ProductGrid products={products} />
            <div className="mt-8">
              <Suspense>
                <Pagination currentPage={page} totalPages={totalPages} />
              </Suspense>
            </div>
          </>
        ) : query ? (
          <EmptyState
            icon={<Search className="h-16 w-16" />}
            title={t("noResults")}
            description={t("noResultsDesc", { query })}
            actionLabel={t("browseAll")}
            actionHref="/products"
          />
        ) : (
          <EmptyState
            icon={<Search className="h-16 w-16" />}
            title={t("emptyTitle")}
            description={t("emptyDesc")}
          />
        )}
      </div>
    </div>
  );
}
