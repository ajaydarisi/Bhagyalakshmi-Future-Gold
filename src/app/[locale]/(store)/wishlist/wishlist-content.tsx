"use client";

import Image from "next/image";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { CheckAvailabilityButton } from "@/components/products/check-availability-button";
import { PriceDisplay } from "@/components/shared/price-display";
import { EmptyState } from "@/components/shared/empty-state";
import { useWishlist } from "@/hooks/use-wishlist";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import { ROUTES } from "@/lib/constants";
import { getCategoryName, getProductName } from "@/lib/i18n-helpers";
import { getWishlistPrimaryActionMode } from "@/lib/offline-store-ui";
import { useLocale, useTranslations } from "next-intl";
import type { ProductWithCategory } from "@/types/product";
import { hapticNotification } from "@/lib/haptics";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { fetchWishlistProducts } from "@/lib/queries/products";

interface WishlistContentProps {
  initialProducts: ProductWithCategory[];
  userId: string;
}

export function WishlistContent({ initialProducts, userId }: WishlistContentProps) {
  const t = useTranslations("wishlist");
  const locale = useLocale();
  const { items, isLoading, removeItem } = useWishlist();
  const { addItem } = useCart();

  const { data: products = initialProducts } = useQuery({
    queryKey: queryKeys.wishlist.products(userId),
    queryFn: () => fetchWishlistProducts(userId),
    initialData: initialProducts,
    staleTime: 60 * 1000,
  });

  const wishlistedProducts = isLoading
    ? products
    : products.filter((p) => items.includes(p.id));
  const primaryActionMode = getWishlistPrimaryActionMode();

  if (wishlistedProducts.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="h-8 w-8" strokeWidth={1.7} />}
        title={t("empty")}
        description={t("emptyDescription")}
        actionLabel={t("browseProducts")}
        actionHref={ROUTES.products}
      />
    );
  }

  async function handleMoveToCart(product: ProductWithCategory) {
    await addItem(product, 1);
    await removeItem(product.id);
    hapticNotification("success");
    toast.success(`${getProductName(product, locale)} moved to cart`);
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {wishlistedProducts.map((product) => {
        const displayName = getProductName(product, locale);
        const initials = (displayName || "BFG").split(" ").slice(0, 2).map((w) => w[0]).join("");
        return (
          <div
            key={product.id}
            className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border bg-surface-card shadow-[var(--shadow-sm)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--border-gold)] hover:shadow-[var(--shadow-lg)]"
            style={{ borderColor: "var(--border-sand)" }}
          >
            <Link
              href={ROUTES.product(product.slug)}
              className="relative block aspect-4/5 overflow-hidden bg-sand-200"
            >
              {product.images[0] ? (
                <Image
                  src={product.images[0]}
                  alt={displayName}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.06]"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center" style={{ background: "var(--grad-gold-soft)" }}>
                  <span className="bfg-foil font-display font-bold" style={{ fontSize: "2.4rem", letterSpacing: "0.06em", opacity: 0.9 }}>
                    {initials}
                  </span>
                </div>
              )}
            </Link>
            <div className="flex flex-1 flex-col gap-2 p-4">
              {product.category && (
                <span className="text-2xs uppercase tracking-[0.1em] text-text-gold">
                  {getCategoryName(product.category, locale)}
                </span>
              )}
              <Link
                href={ROUTES.product(product.slug)}
                className="line-clamp-2 font-body text-base font-semibold leading-snug text-text-primary transition-colors hover:text-text-gold"
              >
                {displayName}
              </Link>
              <PriceDisplay
                price={product.is_sale ? product.price : (product.rental_price ?? product.price)}
                discountPrice={product.is_sale ? product.discount_price : product.rental_discount_price}
                size="sm"
              />
              <div className="mt-auto flex items-center gap-2 pt-2">
                {primaryActionMode === "move-to-cart" ? (
                  <Button
                    variant="gold"
                    size="bfg-sm"
                    className="flex-1"
                    onClick={() => handleMoveToCart(product)}
                    disabled={product.stock === 0}
                  >
                    <ShoppingBag className="mr-1 h-3.5 w-3.5" />
                    {product.stock === 0 ? t("outOfStock") : t("moveToCart")}
                  </Button>
                ) : (
                  <CheckAvailabilityButton
                    productName={displayName}
                    productSlug={product.slug}
                    size="sm"
                    isRental={product.is_rental}
                    maxRentalDays={product.max_rental_days}
                  />
                )}
                <Button
                  variant="gold-outline"
                  size="bfg-sm"
                  className="shrink-0 px-3"
                  aria-label={t("removeFromWishlist")}
                  onClick={() => {
                    hapticNotification("warning");
                    removeItem(product.id);
                    toast.success(t("removed"));
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
