"use client";

import {
  CommandDialog,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import { useProductSearchSuggestions } from "@/hooks/use-product-search-suggestions";
import { ROUTES } from "@/lib/constants";
import { useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { trackEvent } from "@/lib/gtag";
import { ProductSearchSuggestions } from "./product-search-suggestions";

interface ProductSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductSearch({ open, onOpenChange }: ProductSearchProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const t = useTranslations("products.search");
  const locale = useLocale();
  const suggestions = useProductSearchSuggestions({
    query,
    locale,
    enabled: open,
    limit: 6,
  });

  function closeDialog() {
    suggestions.close();
    onOpenChange(false);
  }

  function handleSelectProduct(slug: string) {
    trackEvent("select_content", { content_type: "product", item_id: slug });
    closeDialog();
    setQuery("");
    router.push(ROUTES.product(slug));
  }

  function handleSearchAll() {
    const normalizedQuery = query.trim();
    if (normalizedQuery) {
      trackEvent("search", { search_term: normalizedQuery });
      closeDialog();
      router.push(`${ROUTES.search}?q=${encodeURIComponent(normalizedQuery)}`);
      setQuery("");
    }
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          suggestions.close();
        }
        onOpenChange(nextOpen);
      }}
    >
      <CommandInput
        placeholder={t("placeholder")}
        value={query}
        onValueChange={(value) => {
          suggestions.open();
          setQuery(value);
        }}
      />
      <CommandList>
        <ProductSearchSuggestions
          variant="dialog"
          query={query}
          locale={locale}
          items={suggestions.items}
          isLoading={suggestions.isLoading}
          open={suggestions.isOpen}
          onSelectProduct={(product) => handleSelectProduct(product.slug)}
          onSearchAll={handleSearchAll}
        />
      </CommandList>
    </CommandDialog>
  );
}
