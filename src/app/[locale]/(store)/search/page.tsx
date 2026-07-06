import { SearchResults } from "@/components/products/search-results";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { EmptyState } from "@/components/shared/empty-state";
import { PRODUCTS_PER_PAGE } from "@/lib/constants";
import { searchProducts } from "@/lib/retrieval/catalog";
import { Search } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

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
  const t = await getTranslations("search");
  const tRoot = await getTranslations();
  const locale = await getLocale();
  const response = query
    ? await searchProducts({
        query,
        locale,
        limit: PRODUCTS_PER_PAGE,
        offset: 0,
      })
    : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={[{ label: t("breadcrumb") }]} homeLabel={tRoot("breadcrumbHome")} />

      <div className="mt-6">
        <span className="bfg-eyebrow">{t("breadcrumb")}</span>
        <h1 className="mt-1 font-display text-3xl text-text-primary md:text-4xl">
          {query ? t("resultsFor", { query }) : t("title")}
        </h1>
        {query && response && (
          <p className="mt-1 text-sm text-text-secondary">
            {t("resultCount", { count: response.total })}
          </p>
        )}
      </div>

      <div className="mt-8">
        {response && response.items.length > 0 ? (
          <SearchResults
            query={query}
            locale={locale}
            initialResponse={response}
          />
        ) : query ? (
          <EmptyState
            icon={<Search className="h-8 w-8" strokeWidth={1.7} />}
            title={t("noResults")}
            description={t("noResultsDesc", { query })}
            actionLabel={t("browseAll")}
            actionHref="/products"
          />
        ) : (
          <EmptyState
            icon={<Search className="h-8 w-8" strokeWidth={1.7} />}
            title={t("emptyTitle")}
            description={t("emptyDesc")}
          />
        )}
      </div>
    </div>
  );
}
