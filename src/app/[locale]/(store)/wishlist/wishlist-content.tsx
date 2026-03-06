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
import { IS_ONLINE, ROUTES } from "@/lib/constants";
import { getProductName } from "@/lib/i18n-helpers";
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

  if (wishlistedProducts.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="h-16 w-16" />}
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
        return (
          <div key={product.id} className="group rounded-lg border p-4">
            <Link
              href={ROUTES.product(product.slug)}
              className="relative block aspect-square overflow-hidden rounded-md bg-muted"
            >
              {product.images[0] ? (
                <Image
                  src={product.images[0]}
                  alt={displayName}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  {t("noImage")}
                </div>
              )}
            </Link>
            <div className="mt-3">
              <Link
                href={ROUTES.product(product.slug)}
                className="font-medium hover:text-primary"
              >
                {displayName}
              </Link>
              <div className="mt-1">
                <PriceDisplay
                  price={product.is_sale ? product.price : (product.rental_price ?? product.price)}
                  discountPrice={product.is_sale ? product.discount_price : product.rental_discount_price}
                  size="sm"
                />
              </div>
              <div className="mt-3 flex gap-2">
                {IS_ONLINE ? (
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleMoveToCart(product)}
                    disabled={product.stock === 0}
                  >
                    <ShoppingBag className="mr-1 h-3 w-3" />
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
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    hapticNotification("warning");
                    removeItem(product.id);
                    toast.success(t("removed"));
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
