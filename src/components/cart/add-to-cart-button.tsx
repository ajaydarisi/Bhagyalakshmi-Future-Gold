"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { RentalDatesDialog } from "@/components/products/rental-dates-dialog";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";
import { CalendarDays, Loader2, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Product } from "@/types/product";
import { trackEvent } from "@/lib/gtag";
import { hapticNotification, hapticSelection } from "@/lib/haptics";
import { getCartLineUnitPrice, isRentalOnlyProduct } from "@/lib/product-pricing";

interface AddToCartButtonProps {
  product: Product;
}

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [rentalDialogOpen, setRentalDialogOpen] = useState(false);
  const { items, addItem, updateQuantity } = useCart();
  const t = useTranslations("products.addToCart");
  const tCard = useTranslations("products.card");

  const isOutOfStock = product.stock === 0;
  const isRentalOnly = isRentalOnlyProduct(product);
  // Live quantity of this product already in the cart.
  const cartQty = items.find((i) => i.product.id === product.id)?.quantity ?? 0;

  async function handleAdd(rental?: { start: string; end: string }) {
    setIsAdding(true);
    try {
      await addItem(product, 1, rental);
      trackEvent("add_to_cart", {
        item_id: product.id,
        item_name: product.name,
        price: getCartLineUnitPrice(product, rental?.start, rental?.end),
        quantity: 1,
      });
      hapticNotification("success");
      toast.success(t("addedToast", { name: product.name }));
    } catch {
      hapticNotification("error");
      toast.error(t("errorToast"));
    } finally {
      setIsAdding(false);
    }
  }

  function handleClick() {
    // Rental products need a rental period before they can be priced.
    if (isRentalOnly) {
      setRentalDialogOpen(true);
      return;
    }
    void handleAdd();
  }

  // Once in the cart, the button becomes a live −/+ counter for this product.
  // Stepping down to 0 removes it and reverts to the Add to Cart button.
  if (cartQty > 0) {
    return (
      // Centered so the compact pill never stretches edge-to-edge in a full-width slot.
      <div className="flex w-full justify-center">
        <QuantityStepper
          value={cartQty}
          min={0}
          max={Math.max(1, product.stock)}
          size="md"
          onChange={(v) => {
            hapticSelection();
            void updateQuantity(product.id, v);
          }}
        />
      </div>
    );
  }

  return (
    <>
      <Button
        variant="gold"
        className="w-full"
        size="bfg-md"
        onClick={handleClick}
        disabled={isOutOfStock || isAdding}
      >
        {isAdding ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : isRentalOnly ? (
          <CalendarDays className="mr-2 h-4 w-4" />
        ) : (
          <ShoppingBag className="mr-2 h-4 w-4" />
        )}
        {isOutOfStock
          ? t("outOfStock")
          : isRentalOnly
            ? tCard("rentNow")
            : t("addToCart")}
      </Button>

      {isRentalOnly && (
        <RentalDatesDialog
          open={rentalDialogOpen}
          onOpenChange={setRentalDialogOpen}
          maxRentalDays={product.max_rental_days}
          productId={product.id}
          confirmLabel={tCard("rentNow")}
          confirmIcon={<ShoppingBag className="mr-2 h-4 w-4" />}
          onConfirm={(start, end) =>
            void handleAdd({
              start: format(start, "yyyy-MM-dd"),
              end: format(end, "yyyy-MM-dd"),
            })
          }
        />
      )}
    </>
  );
}
