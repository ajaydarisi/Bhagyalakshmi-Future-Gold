import { createAdminClient } from "@/lib/supabase/admin";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://bhagylakshmi-future-gold.vercel.app";

  // Get all active products
  const { data: products } = await supabase
    .from("products")
    .select("slug, updated_at")
    .eq("is_active", true);

  // Get all categories
  const { data: categories } = await supabase.from("categories").select("slug");

  const productUrls: MetadataRoute.Sitemap = (products || []).map(
    (product) => ({
      url: `${baseUrl}/products/${product.slug}`,
      lastModified: new Date(product.updated_at),
      changeFrequency: "weekly",
      priority: 0.8,
    }),
  );

  const categoryUrls: MetadataRoute.Sitemap = (categories || []).map((cat) => ({
    url: `${baseUrl}/products?category=${cat.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/products`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...categoryUrls,
    ...productUrls,
  ];
}
