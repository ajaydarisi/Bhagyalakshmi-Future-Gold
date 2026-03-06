"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { fetchProduct } from "@/lib/queries/products";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { CheckAvailabilityButton } from "@/components/products/check-availability-button";
import { NotifyStockButton } from "@/components/products/notify-stock-button";
import { ProductImages } from "@/components/products/product-images";
import { ShareButton } from "@/components/products/share-button";
import { PriceDisplay } from "@/components/shared/price-display";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { IS_ONLINE } from "@/lib/constants";
import { formatPrice } from "@/lib/formatters";
import { getCategoryName, getProductDescription, getProductName } from "@/lib/i18n-helpers";
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

  return (
    <div className="mt-8 grid gap-8 md:grid-cols-2">
      {/* Images */}
      <ProductImages images={p.images} name={displayName} />

      {/* Details */}
      <div className="space-y-6">
        <div>
          {p.category && (
            <p className="text-sm text-muted-foreground">
              {getCategoryName(p.category, locale)}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            <h1 className="text-2xl font-bold md:text-3xl">
              {displayName}
            </h1>
            <div className="flex items-center gap-2">
              <ShareButton productName={displayName} productSlug={p.slug} variant="icon" />
              <WishlistButton productId={p.id} variant="icon" />
            </div>
          </div>
          {p.set_number && (
            <p className="text-sm text-muted-foreground">
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
            <Badge variant="default">{t("forSale")}</Badge>
          )}
          {p.is_rental && (
            <Badge variant="outline">{t("forRent")}</Badge>
          )}
          {p.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tc(`tags.${tag}`)}
            </Badge>
          ))}
        </div>

        {/* Rental Pricing */}
        {!p.is_sale && p.is_rental && p.rental_price && (
          <div className="rounded-lg border bg-accent/50 p-4 space-y-2">
            <h3 className="font-semibold">{t("rentalDetails")}</h3>
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

        <div>
          {IS_ONLINE ? (
            <AddToCartButton product={p} />
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

        {IS_ONLINE && (
          <div>
            <h3 className="font-semibold">{t("availability")}</h3>
            <p className="mt-1">
              {p.stock > 0 ? (
                <span className="text-green-600">
                  {t("inStock", { count: p.stock })}
                </span>
              ) : (
                <span className="text-red-600">{t("outOfStock")}</span>
              )}
            </p>
            {p.stock <= 0 && (
              <NotifyStockButton productId={p.id} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
