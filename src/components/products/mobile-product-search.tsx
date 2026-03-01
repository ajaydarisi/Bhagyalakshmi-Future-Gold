"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { useFilterLoading } from "./filter-loading-context";

export function MobileProductSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("products.filters");
  const { setLoading } = useFilterLoading();

  const urlSearch = searchParams.get("search") || "";
  const [query, setQuery] = useState(urlSearch);
  const debouncedQuery = useDebounce(query, 400);
  const prevDebouncedQuery = useRef(debouncedQuery);

  useEffect(() => {
    if (debouncedQuery === prevDebouncedQuery.current) return;
    prevDebouncedQuery.current = debouncedQuery;
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedQuery) {
      params.set("search", debouncedQuery);
    } else {
      params.delete("search");
    }
    params.delete("page");
    setLoading(true);
    router.push(`?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [debouncedQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative mt-4 lg:hidden">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={t("searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pl-9 pr-9 h-10 rounded-lg bg-background"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
