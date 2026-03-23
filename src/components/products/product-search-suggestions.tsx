"use client";

import {
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { formatPrice } from "@/lib/formatters";
import { getCategoryName, getProductName } from "@/lib/i18n-helpers";
import { getProductSearchPriceDisplay } from "@/lib/product-pricing";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProductSearchHit } from "@/types/search";

interface ProductSearchSuggestionsProps {
  query: string;
  locale: string;
  items: ProductSearchHit[];
  isLoading: boolean;
  open: boolean;
  onSelectProduct: (product: ProductSearchHit) => void;
  onSearchAll: () => void;
  variant?: "dialog" | "inline";
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  className?: string;
}

function ProductSuggestionRow({
  locale,
  product,
}: {
  locale: string;
  product: ProductSearchHit;
}) {
  const td = useTranslations("products.detail");
  const pricing = getProductSearchPriceDisplay(product);

  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{getProductName(product, locale)}</p>
        {product.category ? (
          <p className="truncate text-xs text-muted-foreground">
            {getCategoryName(product.category, locale)}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm text-muted-foreground">
          {formatPrice(pricing.amount)}
          {pricing.showPerDay ? td("perDay") : null}
        </div>
        {pricing.originalAmount ? (
          <div className="text-xs text-muted-foreground line-through">
            {formatPrice(pricing.originalAmount)}
          </div>
        ) : null}
      </div>
    </>
  );
}

export function ProductSearchSuggestions({
  query,
  locale,
  items,
  isLoading,
  open,
  onSelectProduct,
  onSearchAll,
  variant = "dialog",
  activeIndex = -1,
  onActiveIndexChange,
  className,
}: ProductSearchSuggestionsProps) {
  const t = useTranslations("products.search");
  const normalizedQuery = query.trim();

  if (!open || normalizedQuery.length < 2) {
    return null;
  }

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "absolute left-0 top-full z-30 mt-2 w-full overflow-hidden rounded-lg border bg-popover shadow-lg",
          className
        )}
      >
        {isLoading && items.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            {t("searching")}
          </div>
        ) : null}

        {!isLoading && items.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            {t("noResults")}
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="p-1">
            {items.map((product, index) => (
              <button
                key={product.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => onActiveIndexChange?.(index)}
                onClick={() => onSelectProduct(product)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  activeIndex === index
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/60"
                )}
              >
                <ProductSuggestionRow locale={locale} product={product} />
              </button>
            ))}
          </div>
        ) : null}

        <div className="border-t p-1">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onActiveIndexChange?.(items.length)}
            onClick={onSearchAll}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
              activeIndex === items.length
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/60"
            )}
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">{t("searchAll", { query: normalizedQuery })}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {isLoading && items.length === 0 ? (
        <div className={cn("px-3 py-6 text-sm text-muted-foreground", className)}>
          {t("searching")}
        </div>
      ) : null}

      {!isLoading && items.length === 0 ? (
        <div className={cn("px-3 py-6 text-sm text-muted-foreground", className)}>
          {t("noResults")}
        </div>
      ) : null}

      {items.length > 0 ? (
        <CommandGroup heading={t("heading")}>
          {items.map((product) => (
            <CommandItem
              key={product.id}
              value={`${product.id} ${product.slug} ${product.name} ${product.name_telugu ?? ""}`}
              onSelect={() => onSelectProduct(product)}
              className="cursor-pointer"
            >
              <Search className="mr-2 h-4 w-4" />
              <ProductSuggestionRow locale={locale} product={product} />
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}

      {items.length > 0 ? <CommandSeparator /> : null}

      <CommandGroup>
        <CommandItem
          value={`search-all ${normalizedQuery}`}
          onSelect={onSearchAll}
          className="cursor-pointer"
        >
          <Search className="mr-2 h-4 w-4" />
          {t("searchAll", { query: normalizedQuery })}
        </CommandItem>
      </CommandGroup>
    </>
  );
}
