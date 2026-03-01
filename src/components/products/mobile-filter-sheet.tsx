"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ProductFilters, type PendingFilters, parseList, getFilterCount } from "./product-filters";
import { useFilterLoading } from "./filter-loading-context";
import type { Category } from "@/types/product";

interface MobileFilterSheetProps {
  categories?: Category[];
}

export function MobileFilterSheet({ categories }: MobileFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const { setLoading } = useFilterLoading();
  const t = useTranslations("products.filters");
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterCount = getFilterCount(searchParams);

  const filtersRef = useRef<PendingFilters>({
    categories: parseList(searchParams.get("category")),
    materials: parseList(searchParams.get("material")),
    type: searchParams.get("type") || "",
    priceRange: [
      Number(searchParams.get("minPrice")) || 0,
      Number(searchParams.get("maxPrice")) || 10000,
    ],
    search: searchParams.get("search") || "",
  });

  const handleFiltersChange = useCallback((filters: PendingFilters) => {
    filtersRef.current = filters;
  }, []);

  function buildUrl(filters: PendingFilters) {
    const params = new URLSearchParams();
    if (filters.categories.length > 0) params.set("category", filters.categories.join(","));
    if (filters.materials.length > 0) params.set("material", filters.materials.join(","));
    if (filters.type && filters.type !== "all") params.set("type", filters.type);
    if (filters.priceRange[0] > 0) params.set("minPrice", filters.priceRange[0].toString());
    if (filters.priceRange[1] < 10000) params.set("maxPrice", filters.priceRange[1].toString());
    if (filters.search) params.set("search", filters.search);
    const currentSort = searchParams.get("sort");
    if (currentSort) params.set("sort", currentSort);
    const qs = params.toString();
    return qs ? `?${qs}` : "/products";
  }

  function handleApply() {
    setApplying(true);
    const url = buildUrl(filtersRef.current);
    // Close sheet first, then navigate after close animation
    setOpen(false);
    setTimeout(() => {
      setLoading(true);
      router.push(url);
      setApplying(false);
    }, 350);
  }

  function handleClear() {
    filtersRef.current = {
      categories: [],
      materials: [],
      type: "",
      priceRange: [0, 10000],
      search: "",
    };
    setOpen(false);
    setTimeout(() => {
      setLoading(true);
      router.push(buildUrl(filtersRef.current));
    }, 350);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          {t("title")}{filterCount > 0 && ` (${filterCount})`}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" showCloseButton={false} className="flex w-80 flex-col overflow-hidden px-0 pb-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <ProductFilters
            categories={categories}
            mode="deferred"
            onFiltersChange={handleFiltersChange}
          />
        </div>
        <SheetFooter className="border-t px-4 py-3">
          <Button
            className="w-full"
            onClick={handleApply}
            disabled={applying}
          >
            {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("applyFilters")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={filterCount === 0}
            className="w-full text-xs text-muted-foreground"
          >
            <X className="mr-1 h-3 w-3" />
            {t("clearAll")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
