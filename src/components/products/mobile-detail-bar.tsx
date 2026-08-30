"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { CheckAvailabilityButton } from "@/components/products/check-availability-button";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { ROUTES } from "@/lib/constants";
import { getProductDetailDisplayState } from "@/lib/offline-store-ui";
import { isRentalOnlyProduct } from "@/lib/product-pricing";
import { trackEvent } from "@/lib/gtag";
import { hapticNotification } from "@/lib/haptics";
import type { ProductWithCategory } from "@/types/product";
import { toast } from "sonner";

interface MobileDetailBarProps {
  product: ProductWithCategory;
  productName: string;
}

/**
 * Sticky bottom action bar for the product detail screen on phones. Sits just
 * above the bottom nav (h-16 + safe area) and is always visible, so the primary
 * add/enquire action never scrolls out of reach. Desktop keeps the inline action.
 */
export function MobileDetailBar({ product, productName }: MobileDetailBarProps) {
  const displayState = getProductDetailDisplayState();
  const { addItem } = useCart();
  const router = useRouter();
  const tCart = useTranslations("products.addToCart");
  const tDetail = useTranslations("products.detail");
  const [buying, setBuying] = useState(false);
  const isOutOfStock = product.stock === 0;

  async function handleBuyNow() {
    setBuying(true);
    try {
      await addItem(product, 1);
      trackEvent("add_to_cart", {
        item_id: product.id,
        item_name: product.name,
        price: product.discount_price || product.price,
        quantity: 1,
      });
      hapticNotification("success");
      router.push(ROUTES.checkout);
    } catch {
      hapticNotification("error");
      toast.error(tCart("errorToast"));
      setBuying(false);
    }
  }

  return (
    <div
      className="fixed inset-x-0 z-40 border-t border-[var(--border-sand)] bg-[var(--surface-card)]/90 px-4 py-3 backdrop-blur-lg md:hidden"
      style={{ bottom: "calc(4rem + var(--safe-area-inset-bottom))" }}
    >
      {displayState.showCartAction ? (
        <div className="flex flex-col gap-2">
          <AddToCartButton product={product} />
          {/* Buy Now skips the rental-dates dialog, so rentals only get Rent Now. */}
          {!isRentalOnlyProduct(product) && (
            <Button
              variant="dark"
              className="w-full"
              size="bfg-lg"
              onClick={handleBuyNow}
              disabled={isOutOfStock || buying}
            >
              {buying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tDetail("buyNow")}
            </Button>
          )}
          <CheckAvailabilityButton
            productName={productName}
            productSlug={product.slug}
            isRental={product.is_rental}
            maxRentalDays={product.max_rental_days}
            label={tDetail("enquireOnWhatsapp")}
            variant="outline"
          />
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <CheckAvailabilityButton
            productName={productName}
            productSlug={product.slug}
            isRental={product.is_rental}
            maxRentalDays={product.max_rental_days}
          />
        </div>
      )}
    </div>
  );
}
