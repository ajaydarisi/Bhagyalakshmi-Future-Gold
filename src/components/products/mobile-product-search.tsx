"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useDebounce } from "@/hooks/use-debounce";
import { ROUTES } from "@/lib/constants";
import { useFilterLoading } from "./filter-loading-context";
import { ProductSearchInput } from "./product-search-input";

export function MobileProductSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("products.filters");
  const { setLoading } = useFilterLoading();

  const urlSearch = searchParams.get("q") || searchParams.get("search") || "";
  const [query, setQuery] = useState(urlSearch);
  const debouncedQuery = useDebounce(query, 400);
  const prevDebouncedQuery = useRef(debouncedQuery);

  function pushSearchQuery(nextQuery: string) {
    const params = new URLSearchParams(searchParams.toString());
    const normalizedQuery = nextQuery.trim();

    if (normalizedQuery) {
      params.set("q", normalizedQuery);
      params.delete("search");
    } else {
      params.delete("q");
      params.delete("search");
    }

    params.delete("page");
    setLoading(true);
    router.push(`?${params.toString()}`);
  }

  useEffect(() => {
    if (debouncedQuery === prevDebouncedQuery.current) return;
    prevDebouncedQuery.current = debouncedQuery;
    pushSearchQuery(debouncedQuery);
  }, [debouncedQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ProductSearchInput
      className="mt-4 lg:hidden"
      inputClassName="h-10 rounded-lg bg-background"
      query={query}
      locale={locale}
      placeholder={t("searchPlaceholder")}
      onQueryChange={setQuery}
      onSubmitSearch={pushSearchQuery}
      onSelectProduct={(product) => {
        router.push(ROUTES.product(product.slug));
      }}
    />
  );
}
