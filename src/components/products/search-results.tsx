"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { ProductGrid } from "@/components/products/product-grid";
import { SearchAiAnswer } from "@/components/products/search-ai-answer";
import { Button } from "@/components/ui/button";
import type { CatalogSearchResponse } from "@/types/search";

interface SearchResultsProps {
  query: string;
  locale: string;
  initialResponse: CatalogSearchResponse;
}

export function SearchResults({
  query,
  locale,
  initialResponse,
}: SearchResultsProps) {
  const t = useTranslations("search");

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["catalog-search", query, locale],
      queryFn: async ({ pageParam }) => {
        const params = new URLSearchParams({
          q: query,
          locale,
          limit: "12",
          offset: String(pageParam),
        });

        const response = await fetch(`/api/search/products?${params.toString()}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Search failed");
        }

        return response.json() as Promise<CatalogSearchResponse>;
      },
      initialPageParam: 0,
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? (lastPage.nextOffset ?? undefined) : undefined,
      initialData: {
        pages: [initialResponse],
        pageParams: [0],
      },
    });

  const products = data?.pages.flatMap((page) => page.items) ?? initialResponse.items;

  return (
    <>
      <SearchAiAnswer query={query} locale={locale} />
      <ProductGrid products={products} />

      {hasNextPage && (
        <div className="mt-8 flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {isFetchingNextPage ? t("loadingMore") : t("loadMore")}
          </Button>
        </div>
      )}

      {!hasNextPage && products.length > 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t("allShown")}
        </p>
      )}
    </>
  );
}
