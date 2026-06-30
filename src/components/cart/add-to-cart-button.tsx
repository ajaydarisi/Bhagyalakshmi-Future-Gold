"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";
import { Loader2, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Product } from "@/types/product";
import { trackEvent } from "@/lib/gtag";
import { hapticNotification, hapticSelection } from "@/lib/haptics";

interface AddToCartButtonProps {
  product: Product;
}

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const [isAdding, setIsAdding] = useState(false);
  const { items, addItem, updateQuantity } = useCart();
  const t = useTranslations("products.addToCart");

  const isOutOfStock = product.stock === 0;
  // Live quantity of this product already in the cart.
  const cartQty = items.find((i) => i.product.id === product.id)?.quantity ?? 0;

  async function handleAdd() {
    setIsAdding(true);
    try {
      await addItem(product, 1);
      trackEvent("add_to_cart", {
        item_id: product.id,
        item_name: product.name,
        price: product.discount_price || product.price,
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
    <Button
      variant="gold"
      className="w-full"
      size="bfg-md"
      onClick={handleAdd}
      disabled={isOutOfStock || isAdding}
    >
      {isAdding ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <ShoppingBag className="mr-2 h-4 w-4" />
      )}
      {isOutOfStock ? t("outOfStock") : t("addToCart")}
    </Button>
  );
}
