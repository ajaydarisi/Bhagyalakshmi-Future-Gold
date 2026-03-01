import type { ProductWithCategory } from "@/types/product";

const CACHE_KEY = "bfg-product-cache";
const MAX_ENTRIES = 20;

interface CachedProduct {
  product: ProductWithCategory;
  cachedAt: number;
}

function readCache(): Map<string, CachedProduct> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    const entries: [string, CachedProduct][] = JSON.parse(raw);
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function writeCache(cache: Map<string, CachedProduct>): void {
  if (typeof window === "undefined") return;
  try {
    const sorted = [...cache.entries()].sort(
      (a, b) => b[1].cachedAt - a[1].cachedAt,
    );
    const trimmed = sorted.slice(0, MAX_ENTRIES);
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage quota exceeded — fail silently
  }
}

export function cacheProduct(product: ProductWithCategory): void {
  const cache = readCache();
  cache.set(product.id, { product, cachedAt: Date.now() });
  writeCache(cache);
}

export function getCachedProductBySlug(
  slug: string,
): ProductWithCategory | null {
  const cache = readCache();
  for (const { product } of cache.values()) {
    if (product.slug === slug) return product;
  }
  return null;
}
