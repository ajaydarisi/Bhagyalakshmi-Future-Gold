import { ProductCacheWriter } from "@/components/products/product-cache-writer";
import { ProductDetailContent } from "@/components/products/product-detail-content";
import { RelatedProductsContent } from "@/components/products/related-products-content";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { ProductGridSkeleton } from "@/components/shared/loading-skeleton";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { getCategoryName, getProductDescription, getProductName } from "@/lib/i18n-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProductWithCategory } from "@/types/product";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";

const RELATED_PRODUCT_FIELDS =
  "id, name, name_telugu, slug, price, discount_price, images, tags, stock, is_sale, is_rental, rental_price, material, category:categories(name, name_telugu, slug)";

const getProduct = unstable_cache(
  async (slug: string) => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select("*, category:categories(name, name_telugu, slug)")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();
    return data;
  },
  ["product"],
  { revalidate: 300 }
);

const getRelatedProducts = unstable_cache(
  async (categoryId: string, excludeId: string) => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select(RELATED_PRODUCT_FIELDS)
      .eq("is_active", true)
      .eq("category_id", categoryId)
      .neq("id", excludeId)
      .limit(4);
    return data;
  },
  ["related-products"],
  { revalidate: 300 }
);

export async function generateStaticParams() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("products")
    .select("slug")
    .eq("is_active", true);
  return (data ?? []).map((p) => ({ slug: p.slug }));
}

export const revalidate = 3600;

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  const locale = await getLocale();

  const t = await getTranslations("products.detail");
  const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://bfg.darisi.in";

  if (!product) return { title: t("notFoundMeta") };

  const displayName = getProductName(product, locale);
  const displayDesc = getProductDescription(product, locale);

  return {
    title: displayName,
    description: displayDesc || t("metaDescription", { name: displayName }),
    alternates: {
      canonical: `${SITE_URL}/products/${slug}`,
      languages: {
        en: `${SITE_URL}/products/${slug}`,
        te: `${SITE_URL}/te/products/${slug}`,
      },
    },
    openGraph: {
      title: displayName,
      description: displayDesc || undefined,
      type: "website",
      images: product.images[0]
        ? [{ url: product.images[0], alt: displayName }]
        : undefined,
    },
  };
}

async function RelatedProductsServer({
  categoryId,
  productId,
}: {
  categoryId: string;
  productId: string;
}) {
  const relatedProducts = await getRelatedProducts(categoryId, productId);

  return (
    <RelatedProductsContent
      initialProducts={(relatedProducts ?? []) as unknown as ProductWithCategory[]}
      categoryId={categoryId}
      excludeId={productId}
    />
  );
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) notFound();

  const locale = await getLocale();
  const tl = await getTranslations("products.listing");
  const tCommon = await getTranslations();

  const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://bfg.darisi.in";

  const typedProduct = product as unknown as ProductWithCategory;
  const displayName = getProductName(typedProduct, locale);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: getProductName(typedProduct, "en"),
    ...(getProductDescription(typedProduct, "en") && {
      description: getProductDescription(typedProduct, "en"),
    }),
    ...(typedProduct.images[0] && { image: typedProduct.images[0] }),
    sku: typedProduct.id,
    brand: { "@type": "Brand", name: APP_NAME },
    ...(typedProduct.is_sale && {
      offers: {
        "@type": "Offer",
        price: typedProduct.discount_price || typedProduct.price,
        priceCurrency: "INR",
        availability:
          typedProduct.stock > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        seller: { "@type": "Organization", name: APP_NAME },
      },
    }),
    ...(typedProduct.category && {
      category: getCategoryName(typedProduct.category, "en"),
    }),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Products",
        item: `${SITE_URL}/products`,
      },
      ...(typedProduct.category
        ? [
          {
            "@type": "ListItem",
            position: 3,
            name: getCategoryName(typedProduct.category, "en"),
            item: `${SITE_URL}/products?category=${typedProduct.category.slug}`,
          },
        ]
        : []),
      {
        "@type": "ListItem",
        position: typedProduct.category ? 4 : 3,
        name: getProductName(typedProduct, "en"),
      },
    ],
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <ProductCacheWriter product={typedProduct} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([productJsonLd, breadcrumbJsonLd]),
        }}
      />
      <Breadcrumbs
        homeLabel={tCommon("breadcrumbHome")}
        items={[
          { label: tl("breadcrumb"), href: ROUTES.products },
          ...(typedProduct.category
            ? [
              {
                label: getCategoryName(typedProduct.category, locale),
                href: `${ROUTES.products}?category=${typedProduct.category.slug}`,
              },
            ]
            : []),
          { label: displayName },
        ]}
      />

      <ProductDetailContent initialProduct={typedProduct} />

      {/* Related Products */}
      {typedProduct.category_id && (
        <Suspense fallback={<div className="mt-16"><ProductGridSkeleton count={4} /></div>}>
          <RelatedProductsServer
            categoryId={typedProduct.category_id}
            productId={typedProduct.id}
          />
        </Suspense>
      )}
    </div>
  );
}
