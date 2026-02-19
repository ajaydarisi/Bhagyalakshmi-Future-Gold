"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { createClient } from "@/lib/supabase/client";
import { useDebounce } from "@/hooks/use-debounce";
import { Search } from "lucide-react";
import { formatPrice } from "@/lib/formatters";
import { ROUTES } from "@/lib/constants";

interface ProductSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  price: number;
  discount_price: number | null;
}

export function ProductSearch({ open, onOpenChange }: ProductSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const router = useRouter();

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    async function search() {
      setIsSearching(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, price, discount_price")
        .textSearch("fts", debouncedQuery, { type: "websearch" })
        .eq("is_active", true)
        .limit(8);

      setResults(data || []);
      setIsSearching(false);
    }

    search();
  }, [debouncedQuery]);

  function handleSelect(slug: string) {
    onOpenChange(false);
    setQuery("");
    router.push(ROUTES.product(slug));
  }

  function handleSearchAll() {
    if (query) {
      onOpenChange(false);
      router.push(`${ROUTES.search}?q=${encodeURIComponent(query)}`);
      setQuery("");
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search for jewelry..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isSearching ? "Searching..." : "No products found."}
        </CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading="Products">
            {results.map((product) => (
              <CommandItem
                key={product.id}
                onSelect={() => handleSelect(product.slug)}
                className="cursor-pointer"
              >
                <Search className="mr-2 h-4 w-4" />
                <span className="flex-1">{product.name}</span>
                <span className="text-sm text-muted-foreground">
                  {formatPrice(product.discount_price || product.price)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {query && (
          <CommandGroup>
            <CommandItem onSelect={handleSearchAll} className="cursor-pointer">
              <Search className="mr-2 h-4 w-4" />
              Search all for &quot;{query}&quot;
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
