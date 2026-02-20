import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { CheckAvailabilityButton } from "@/components/products/check-availability-button";
import { ProductGrid } from "@/components/products/product-grid";
import { ProductImages } from "@/components/products/product-images";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { PriceDisplay } from "@/components/shared/price-display";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { IS_ONLINE, ROUTES } from "@/lib/constants";
import { formatPrice } from "@/lib/formatters";
import { getCategoryName, getProductName, getProductDescription } from "@/lib/i18n-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProductWithCategory } from "@/types/product";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getTranslations, getLocale } from "next-intl/server";

const getProduct = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, category:categories(name, name_telugu, slug)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  return data;
});

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

  if (!product) return { title: t("notFoundMeta") };

  const displayName = getProductName(product, locale);
  const displayDesc = getProductDescription(product, locale);

  return {
    title: displayName,
    description: displayDesc || t("metaDescription", { name: displayName }),
    openGraph: {
      title: displayName,
      description: displayDesc || undefined,
      images: product.images[0] ? [product.images[0]] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) notFound();

  const locale = await getLocale();
  const t = await getTranslations("products.detail");
  const tl = await getTranslations("products.listing");
  const tc = await getTranslations("constants");

  // Fetch related products from same category
  const supabase = await createClient();
  const { data: relatedProducts } = await supabase
    .from("products")
    .select("*, category:categories(name, name_telugu, slug)")
    .eq("is_active", true)
    .eq("category_id", product.category_id!)
    .neq("id", product.id)
    .limit(4);

  const typedProduct = product as unknown as ProductWithCategory;
  const displayName = getProductName(typedProduct, locale);
  const displayDescription = getProductDescription(typedProduct, locale);
  // Show the alternate language name as subtitle
  const subtitleName = locale === "te" ? typedProduct.name : typedProduct.name_telugu;

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs
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
            <h1 className="text-2xl font-bold md:text-3xl">
              {displayName}
            </h1>
            {subtitleName && (
              <p className="text-sm text-muted-foreground mt-1">
                {subtitleName}
              </p>
            )}
          </div>

          <PriceDisplay
            price={typedProduct.price}
            discountPrice={typedProduct.discount_price}
            size="lg"
          />

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
          {typedProduct.is_rental && typedProduct.rental_price && (
            <div className="rounded-lg border bg-accent/50 p-4 space-y-2">
              <h3 className="font-semibold">{t("rentalDetails")}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("rentalPrice")}</span>
                  <span className="ml-2 font-medium">
                    {formatPrice(typedProduct.rental_price)}
                  </span>
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

          <Separator />

          <div className="flex gap-3">
            <div className="flex-1">
              {IS_ONLINE ? (
                <AddToCartButton product={typedProduct} />
              ) : (
                <CheckAvailabilityButton
                  productName={displayName}
                  productSlug={typedProduct.slug}
                />
              )}
            </div>
            <WishlistButton productId={typedProduct.id} />
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts && relatedProducts.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-xl font-bold">{t("relatedProducts")}</h2>
          <ProductGrid
            products={relatedProducts as unknown as ProductWithCategory[]}
          />
        </section>
      )}
    </div>
  );
}
