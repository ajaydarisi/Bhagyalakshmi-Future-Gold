import { createAdminClient } from "@/lib/supabase/admin";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://bfg.darisi.in";

  // Get all active products
  const { data: products } = await supabase
    .from("products")
    .select("slug, updated_at")
    .eq("is_active", true);

  // Get all categories
  const { data: categories } = await supabase.from("categories").select("slug");

  const alternates = (path: string) => ({
    languages: {
      en: `${baseUrl}${path}`,
      te: `${baseUrl}/te${path}`,
    },
  });

  const productUrls: MetadataRoute.Sitemap = (products || []).map(
    (product) => ({
      url: `${baseUrl}/products/${product.slug}`,
      lastModified: new Date(product.updated_at),
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: alternates(`/products/${product.slug}`),
    }),
  );

  const categoryUrls: MetadataRoute.Sitemap = (categories || []).map((cat) => ({
    url: `${baseUrl}/products?category=${cat.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
    alternates: alternates(`/products?category=${cat.slug}`),
  }));

  return [
    {
      url: baseUrl,
      changeFrequency: "daily",
      priority: 1,
      alternates: alternates("/"),
    },
    {
      url: `${baseUrl}/products`,
      changeFrequency: "daily",
      priority: 0.9,
      alternates: alternates("/products"),
    },
    {
      url: `${baseUrl}/about`,
      changeFrequency: "monthly",
      priority: 0.5,
      alternates: alternates("/about"),
    },
    ...categoryUrls,
    ...productUrls,
  ];
}
