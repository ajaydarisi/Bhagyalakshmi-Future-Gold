import { createClient } from "@/lib/supabase/client";
import { cacheProduct } from "@/lib/product-cache";
import { preloadProductImages } from "@/lib/image-preloader";
import type { ProductWithCategory } from "@/types/product";

const PREFETCH_META_KEY = "bfg-prefetch-meta";
const PREFETCH_CATEGORIES_KEY = "bfg-prefetch-categories";
const PREFETCH_FEATURED_KEY = "bfg-prefetch-featured";
const CACHE_WARMED_KEY = "bfg-cache-warmed";
const PREFETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export async function prefetchEssentialData(): Promise<void> {
  // Throttle: don't prefetch if done recently
  const lastPrefetch = parseInt(
    localStorage.getItem(PREFETCH_META_KEY) || "0",
  );
  if (Date.now() - lastPrefetch < PREFETCH_INTERVAL) return;

  try {
    const supabase = createClient();

    const [categoriesRes, featuredRes] = await Promise.allSettled([
      supabase
        .from("categories")
        .select("id, name, name_telugu, slug")
        .is("parent_id", null)
        .order("sort_order"),
      supabase
        .from("products")
        .select("*, category:categories(name, name_telugu, slug)")
        .eq("is_active", true)
        .eq("featured", true)
        .limit(8),
    ]);

    if (
      categoriesRes.status === "fulfilled" &&
      categoriesRes.value.data
    ) {
      localStorage.setItem(
        PREFETCH_CATEGORIES_KEY,
        JSON.stringify(categoriesRes.value.data),
      );
    }

    if (
      featuredRes.status === "fulfilled" &&
      featuredRes.value.data
    ) {
      localStorage.setItem(
        PREFETCH_FEATURED_KEY,
        JSON.stringify(featuredRes.value.data),
      );

      // Populate product cache and preload images
      const products = featuredRes.value.data as ProductWithCategory[];
      const imageUrls: string[] = [];

      for (const product of products) {
        cacheProduct(product);
        if (product.images && product.images.length > 0) {
          imageUrls.push(product.images[0]);
        }
      }

      if (imageUrls.length > 0) {
        preloadProductImages(imageUrls);
      }
    }

    localStorage.setItem(PREFETCH_META_KEY, String(Date.now()));
  } catch {
    // Prefetch is best-effort — fail silently
  }
}

export async function warmCachesOnFirstLoad(): Promise<void> {
  if (localStorage.getItem(CACHE_WARMED_KEY)) return;

  await prefetchEssentialData();

  // Preload all featured product images (not just first per product)
  try {
    const featured = localStorage.getItem(PREFETCH_FEATURED_KEY);
    if (featured) {
      const products: ProductWithCategory[] = JSON.parse(featured);
      const allImageUrls = products.flatMap((p) => p.images || []);
      if (allImageUrls.length > 0) {
        preloadProductImages(allImageUrls);
      }
    }
  } catch {
    // Best-effort
  }

  localStorage.setItem(CACHE_WARMED_KEY, "1");
}
