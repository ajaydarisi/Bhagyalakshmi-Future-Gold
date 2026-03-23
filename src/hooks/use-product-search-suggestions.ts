"use client";

import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import type { CatalogSearchResponse, ProductSearchHit } from "@/types/search";

interface UseProductSearchSuggestionsArgs {
  query: string;
  locale: string;
  enabled?: boolean;
  limit?: number;
}

export function useProductSearchSuggestions({
  query,
  locale,
  enabled = true,
  limit = 6,
}: UseProductSearchSuggestionsArgs) {
  const normalizedQuery = query.trim();
  const debouncedQuery = useDebounce(normalizedQuery, 275);
  const [items, setItems] = useState<ProductSearchHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const isEligible = debouncedQuery.length >= 2;

  useEffect(() => {
    setDismissed(false);
  }, [debouncedQuery, enabled]);

  useEffect(() => {
    if (!enabled || dismissed || !isEligible) {
      if (!isEligible) {
        setItems([]);
      }
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchSuggestions() {
      setIsLoading(true);

      try {
        const params = new URLSearchParams({
          q: debouncedQuery,
          locale,
          limit: String(limit),
        });
        const response = await fetch(`/api/search/products?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Suggestion fetch failed");
        }

        const data = (await response.json()) as CatalogSearchResponse;
        setItems(data.items ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setItems([]);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchSuggestions();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, dismissed, enabled, isEligible, limit, locale]);

  const open = useCallback(() => {
    setDismissed(false);
  }, []);

  const close = useCallback(() => {
    setDismissed(true);
  }, []);

  return {
    items,
    isLoading,
    isOpen: enabled && normalizedQuery.length >= 2 && !dismissed,
    open,
    close,
  };
}
