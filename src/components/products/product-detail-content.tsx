"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { fetchProduct } from "@/lib/queries/products";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { CheckAvailabilityButton } from "@/components/products/check-availability-button";
import { NotifyStockButton } from "@/components/products/notify-stock-button";
import { ProductImages } from "@/components/products/product-images";
import { MobileDetailBar } from "@/components/products/mobile-detail-bar";
import { ShareButton } from "@/components/products/share-button";
import { PriceDisplay } from "@/components/shared/price-display";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { formatPrice } from "@/lib/formatters";
import { getCategoryName, getProductDescription, getProductName } from "@/lib/i18n-helpers";
import { getProductDetailDisplayState } from "@/lib/offline-store-ui";
import type { ProductWithCategory } from "@/types/product";
import { useLocale, useTranslations } from "next-intl";

interface ProductDetailContentProps {
  initialProduct: ProductWithCategory;
}

export function ProductDetailContent({ initialProduct }: ProductDetailContentProps) {
  const t = useTranslations("products.detail");
  const tc = useTranslations("constants");
  const locale = useLocale();

  const { data: product = initialProduct } = useQuery({
    queryKey: queryKeys.products.detail(initialProduct.slug),
    queryFn: () => fetchProduct(initialProduct.slug),
    initialData: initialProduct,
    staleTime: 2 * 60 * 1000,
  });

  // product could be null from fetchProduct, fall back to initialProduct
  const p = product ?? initialProduct;
  const displayName = getProductName(p, locale);
  const displayDescription = getProductDescription(p, locale);
  const displayState = getProductDetailDisplayState();

  return (
    <div className="mt-8 grid gap-8 pb-24 md:grid-cols-2 md:pb-0">
      {/* Images */}
      <ProductImages images={p.images} name={displayName} />

      {/* Details */}
      <div className="space-y-6">
        <div>
          {p.category && (
            <p className="text-2xs uppercase tracking-[0.12em] text-text-gold">
              {getCategoryName(p.category, locale)}
            </p>
          )}

          <div className="mt-1 flex items-start justify-between gap-2">
            <h1 className="font-display text-3xl text-text-primary md:text-4xl">
              {displayName}
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              <ShareButton productName={displayName} productSlug={p.slug} variant="icon" />
              <WishlistButton productId={p.id} variant="icon" />
            </div>
          </div>
          {p.set_number && (
            <p className="mt-1 text-sm text-text-secondary">
              {t("setNumber", { number: p.set_number })}
            </p>
          )}
        </div>

        {p.is_sale && (
          <PriceDisplay
            price={p.price}
            discountPrice={p.discount_price}
            size="lg"
          />
        )}

        <div className="flex flex-wrap gap-2">
          {p.is_sale && (
            <Badge variant="solid" size="md">{t("forSale")}</Badge>
          )}
          {p.is_rental && (
            <Badge variant="rental" size="md">{t("forRent")}</Badge>
          )}
          {p.tags.map((tag) => (
            <Badge key={tag} variant="gold" size="md">
              {tc(`tags.${tag}`)}
            </Badge>
          ))}
        </div>

        {/* Rental Pricing */}
        {!p.is_sale && p.is_rental && p.rental_price && (
          <div className="space-y-2 rounded-[var(--radius-bfg-lg)] border border-[var(--border-gold)] p-4" style={{ background: "var(--bg-page-warm)" }}>
            <h3 className="font-semibold text-text-primary">{t("rentalDetails")}</h3>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <div className="flex">
                <span className="text-muted-foreground">{t("rentalPrice")}</span>
                <div className="ml-2">
                  <PriceDisplay
                    price={p.rental_price}
                    discountPrice={p.rental_discount_price}
                    size="sm"
                  />
                </div>
              </div>
              {p.rental_deposit && (
                <div>
                  <span className="text-muted-foreground">{t("deposit")}</span>
                  <span className="ml-2 font-medium">
                    {formatPrice(p.rental_deposit)}
                  </span>
                </div>
              )}
              {p.max_rental_days && (
                <div>
                  <span className="text-muted-foreground">{t("maxDuration")}</span>
                  <span className="ml-2 font-medium">
                    {t("days", { count: p.max_rental_days })}
                  </span>
                </div>
              )}
            </div>
            {p.category?.slug === "marriage-rental-sets" && (
              <p className="text-sm text-muted-foreground italic mt-2">
                {t("rentalSetNote")}
              </p>
            )}
          </div>
        )}

        {/* Inline action — desktop/tablet. Phones use the sticky bottom bar. */}
        <div className="hidden space-y-2 md:block">
          {displayState.showCartAction ? (
            <>
              <AddToCartButton product={p} />
              <CheckAvailabilityButton
                productName={displayName}
                productSlug={p.slug}
                isRental={p.is_rental}
                maxRentalDays={p.max_rental_days}
                label={t("enquireOnWhatsapp")}
                variant="outline"
              />
            </>
          ) : (
            <CheckAvailabilityButton
              productName={displayName}
              productSlug={p.slug}
              isRental={p.is_rental}
              maxRentalDays={p.max_rental_days}
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

        {p.material && (
          <div>
            <h3 className="font-semibold">{t("material")}</h3>
            <p className="mt-1 text-muted-foreground">
              {tc(`materials.${p.material}`)}
            </p>
          </div>
        )}

        {displayState.showStockAvailability && (
          <div>
            <h3 className="font-semibold">{t("availability")}</h3>
            <p className="mt-1">
              {p.stock > 0 ? (
                <span className="text-[var(--bfg-success)]">
                  {t("inStock", { count: p.stock })}
                </span>
              ) : (
                <span className="text-[var(--bfg-error)]">{t("outOfStock")}</span>
              )}
            </p>
            {p.stock <= 0 && (
              <NotifyStockButton productId={p.id} />
            )}
          </div>
        )}
      </div>

      {/* Sticky bottom action bar — phones only */}
      <MobileDetailBar product={p} productName={displayName} />
    </div>
  );
}
