import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Live `categories.slug` values, for validating a model-proposed product-filter
 * navigation. Without this the assistant can emit a category that parses fine,
 * survives the manifest's byte-compare invariant, and still lands the customer
 * on a valid page with zero results.
 *
 * Admin client because this runs on unauthenticated assistant requests and
 * slugs are public catalog data. Cached for the same 300s as the storefront's
 * own category reads; a new category becomes navigable within that window.
 */
export const getKnownCategorySlugs = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase.from("categories").select("slug");
    return (data ?? [])
      .map((row) => row.slug)
      .filter((slug): slug is string => Boolean(slug));
  },
  ["assistant-known-category-slugs"],
  { revalidate: 300 },
);
