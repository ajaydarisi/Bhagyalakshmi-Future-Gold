import { Suspense } from "react";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { CheckAvailabilityButton } from "@/components/products/check-availability-button";
import { ProductGrid } from "@/components/products/product-grid";
import { ProductImages } from "@/components/products/product-images";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { ProductGridSkeleton } from "@/components/shared/loading-skeleton";
import { PriceDisplay } from "@/components/shared/price-display";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { ProductCacheWriter } from "@/components/products/product-cache-writer";
import { APP_NAME, IS_ONLINE, ROUTES } from "@/lib/constants";
import { formatPrice } from "@/lib/formatters";
import { getCategoryName, getProductDescription, getProductName } from "@/lib/i18n-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProductWithCategory } from "@/types/product";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

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
  { revalidate: 3600 }
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
  { revalidate: 3600 }
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

async function RelatedProducts({
  categoryId,
  productId,
}: {
  categoryId: string;
  productId: string;
}) {
  const relatedProducts = await getRelatedProducts(categoryId, productId);
  const t = await getTranslations("products.detail");

  if (!relatedProducts || relatedProducts.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="mb-6 text-xl font-bold">{t("relatedProducts")}</h2>
      <ProductGrid
        products={relatedProducts as unknown as ProductWithCategory[]}
      />
    </section>
  );
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) notFound();

  const locale = await getLocale();
  const t = await getTranslations("products.detail");
  const tl = await getTranslations("products.listing");
  const tc = await getTranslations("constants");
  const tCommon = await getTranslations();

  const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://bfg.darisi.in";

  const typedProduct = product as unknown as ProductWithCategory;
  const displayName = getProductName(typedProduct, locale);
  const displayDescription = getProductDescription(typedProduct, locale);

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

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        {/* Images */}
        <ProductImages images={typedProduct.images} name={displayName} />

        {/* Details */}
        <div className="space-y-6">
          <div>
            {typedProduct.category && (
              <p className="text-sm text-muted-foreground">
                {getCategoryName(typedProduct.category, locale)}
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-2xl font-bold md:text-3xl">
                {displayName}
              </h1>
              <WishlistButton productId={typedProduct.id} />
            </div>
          </div>

          {typedProduct.is_sale && (
            <PriceDisplay
              price={typedProduct.price}
              discountPrice={typedProduct.discount_price}
              size="lg"
            />
          )}

          <div className="flex flex-wrap gap-2">
            {typedProduct.is_sale && (
              <Badge variant="default">{t("forSale")}</Badge>
            )}
            {typedProduct.is_rental && (
              <Badge variant="outline">{t("forRent")}</Badge>
            )}
            {typedProduct.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tc(`tags.${tag}`)}
              </Badge>
            ))}
          </div>

          {/* Rental Pricing */}
          {!typedProduct.is_sale && typedProduct.is_rental && typedProduct.rental_price && (
            <div className="rounded-lg border bg-accent/50 p-4 space-y-2">
              <h3 className="font-semibold">{t("rentalDetails")}</h3>
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                <div className="flex">
                  <span className="text-muted-foreground">{t("rentalPrice")}</span>
                  <div className="ml-2">
                    <PriceDisplay
                      price={typedProduct.rental_price}
                      discountPrice={typedProduct.rental_discount_price}
                      size="sm"
                    />
                  </div>
                </div>
                {typedProduct.rental_deposit && (
                  <div>
                    <span className="text-muted-foreground">{t("deposit")}</span>
                    <span className="ml-2 font-medium">
                      {formatPrice(typedProduct.rental_deposit)}
                    </span>
                  </div>
                )}
                {typedProduct.max_rental_days && (
                  <div>
                    <span className="text-muted-foreground">{t("maxDuration")}</span>
                    <span className="ml-2 font-medium">
                      {t("days", { count: typedProduct.max_rental_days })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}


          <div>
            {IS_ONLINE ? (
              <AddToCartButton product={typedProduct} />
            ) : (
              <CheckAvailabilityButton
              productName={displayName}
                productSlug={typedProduct.slug}
              />
            )}
          </div>

          <Separator />

          {displayDescription && (
            <div>
              <h3 className="font-semibold">{t("description")}</h3>
              <p className="mt-2 text-muted-foreground whitespace-pre-line">
                {displayDescription}
              </p>
            </div>
          )}

          {typedProduct.material && (
            <div>
              <h3 className="font-semibold">{t("material")}</h3>
              <p className="mt-1 text-muted-foreground">
                {tc(`materials.${typedProduct.material}`)}
              </p>
            </div>
          )}

          {IS_ONLINE && (
            <div>
              <h3 className="font-semibold">{t("availability")}</h3>
              <p className="mt-1">
                {typedProduct.stock > 0 ? (
                  <span className="text-green-600">
                    {t("inStock", { count: typedProduct.stock })}
                  </span>
                ) : (
                  <span className="text-red-600">{t("outOfStock")}</span>
                )}
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Related Products */}
      {typedProduct.category_id && (
        <Suspense fallback={<div className="mt-16"><ProductGridSkeleton count={4} /></div>}>
          <RelatedProducts
            categoryId={typedProduct.category_id}
            productId={typedProduct.id}
          />
        </Suspense>
      )}
    </div>
  );
}
