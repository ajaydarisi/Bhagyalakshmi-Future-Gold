"use client";

import { useRef, useEffect, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import {
  fetchProducts,
  type FetchProductsResponse,
  type FetchProductsParams,
} from "@/lib/queries/products";
import { ProductGrid } from "./product-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { PRODUCTS_PER_PAGE } from "@/lib/constants";
import { Search, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProductWithCategory } from "@/types/product";

interface ProductsContentProps {
  initialProducts: ProductWithCategory[];
  initialCount: number;
  filterParams: FetchProductsParams;
}

export function ProductsContent({
  initialProducts,
  initialCount,
  filterParams,
}: ProductsContentProps) {
  const t = useTranslations("products.listing");
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Exclude page from the query key so all pages share one cache entry
  const queryKeyParams = { ...filterParams };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.products.list(
      queryKeyParams as unknown as Record<string, unknown>
    ),
    queryFn: ({ pageParam }) =>
      fetchProducts({ ...filterParams, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: FetchProductsResponse, allPages) => {
      if (typeof lastPage.hasMore === "boolean") {
        return lastPage.hasMore ? allPages.length + 1 : undefined;
      }

      const totalFetched = allPages.reduce(
        (sum, p) => sum + (p.products?.length || 0),
        0
      );
      return totalFetched < (lastPage?.count || 0) ? allPages.length + 1 : undefined;
    },
    initialData: {
      pages: [{ products: initialProducts || [], count: initialCount || 0 }],
      pageParams: [1],
    },
    staleTime: 60 * 1000,
  });

  const products = data?.pages.flatMap((p) => p.products || []) ?? (initialProducts || []);
  const count = data?.pages[0]?.count ?? initialCount;

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: "200px",
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersect]);

  if (products.length === 0) {
    return (
      <EmptyState
        icon={<Search className="h-16 w-16" />}
        title={t("noProducts")}
        description={t("noProductsDesc")}
        actionLabel={t("clearFilters")}
        actionHref="/products"
      />
    );
  }

  return (
    <>
      <ProductGrid products={products} />

      {/* Sentinel element for IntersectionObserver */}
      <div ref={sentinelRef} className="h-1" />

      {isFetchingNextPage && (
        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{t("loadingMore")}</span>
        </div>
      )}

      {!hasNextPage && count > PRODUCTS_PER_PAGE && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t("noMoreProducts")}
        </p>
      )}
    </>
  );
}
