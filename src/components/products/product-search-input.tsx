"use client";

import { Input } from "@/components/ui/input";
import { useProductSearchSuggestions } from "@/hooks/use-product-search-suggestions";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import { useState } from "react";
import { ProductSearchSuggestions } from "./product-search-suggestions";
import type { ProductSearchHit } from "@/types/search";

interface ProductSearchInputProps {
  query: string;
  locale: string;
  placeholder: string;
  onQueryChange: (query: string) => void;
  onSubmitSearch: (query: string) => void;
  onSelectProduct: (product: ProductSearchHit) => void;
  className?: string;
  inputClassName?: string;
}

export function ProductSearchInput({
  query,
  locale,
  placeholder,
  onQueryChange,
  onSubmitSearch,
  onSelectProduct,
  className,
  inputClassName,
}: ProductSearchInputProps) {
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = useProductSearchSuggestions({
    query,
    locale,
    enabled: isFocusWithin,
    limit: 6,
  });
  const normalizedQuery = query.trim();
  const actionCount = normalizedQuery.length >= 2 ? suggestions.items.length + 1 : 0;
  const visibleActiveIndex =
    activeIndex >= 0 && activeIndex < actionCount ? activeIndex : -1;

  function closeSuggestions() {
    suggestions.close();
    setActiveIndex(-1);
  }

  function handleSelectProduct(product: ProductSearchHit) {
    closeSuggestions();
    onSelectProduct(product);
  }

  function handleSubmitSearch() {
    if (!normalizedQuery) {
      closeSuggestions();
      return;
    }

    closeSuggestions();
    onSubmitSearch(normalizedQuery);
  }

  function moveActiveIndex(direction: -1 | 1) {
    if (actionCount === 0) {
      return;
    }

    suggestions.open();
    setActiveIndex((currentIndex) => {
      if (currentIndex === -1) {
        return direction === 1 ? 0 : actionCount - 1;
      }

      return (currentIndex + direction + actionCount) % actionCount;
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveIndex(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveIndex(-1);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeSuggestions();
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    if (!normalizedQuery) {
      return;
    }

    event.preventDefault();

    if (visibleActiveIndex >= 0 && visibleActiveIndex < suggestions.items.length) {
      handleSelectProduct(suggestions.items[visibleActiveIndex]!);
      return;
    }

    handleSubmitSearch();
  }

  return (
    <div
      className={cn("relative", className)}
      onFocusCapture={() => {
        setIsFocusWithin(true);
        suggestions.open();
      }}
      onBlurCapture={(event) => {
        const nextFocusedElement = event.relatedTarget;
        if (nextFocusedElement instanceof Node && event.currentTarget.contains(nextFocusedElement)) {
          return;
        }

        setIsFocusWithin(false);
        closeSuggestions();
      }}
    >
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={query}
        onChange={(event) => {
          suggestions.open();
          setActiveIndex(-1);
          onQueryChange(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        className={cn("h-9 pl-9 pr-8", inputClassName)}
      />
      {query ? (
        <button
          type="button"
          onClick={() => {
            closeSuggestions();
            onQueryChange("");
          }}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      <ProductSearchSuggestions
        variant="inline"
        query={query}
        locale={locale}
        items={suggestions.items}
        isLoading={suggestions.isLoading}
        open={suggestions.isOpen}
        activeIndex={visibleActiveIndex}
        onActiveIndexChange={setActiveIndex}
        onSelectProduct={handleSelectProduct}
        onSearchAll={handleSubmitSearch}
      />
    </div>
  );
}
