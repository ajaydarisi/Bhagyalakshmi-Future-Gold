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
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const { addItem } = useCart();
  const t = useTranslations("products.addToCart");

  const isOutOfStock = product.stock === 0;

  async function handleAdd() {
    setIsAdding(true);
    try {
      await addItem(product, quantity);
      trackEvent("add_to_cart", {
        item_id: product.id,
        item_name: product.name,
        price: product.discount_price || product.price,
        quantity,
      });
      hapticNotification("success");
      toast.success(t("addedToast", { name: product.name }));
      setQuantity(1);
    } catch {
      hapticNotification("error");
      toast.error(t("errorToast"));
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="flex flex-1 items-center gap-3">
      <QuantityStepper
        value={quantity}
        min={1}
        max={Math.max(1, product.stock)}
        onChange={(v) => {
          hapticSelection();
          setQuantity(v);
        }}
      />
      <Button
        variant="gold"
        className="flex-1"
        size="bfg-lg"
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
    </div>
  );
}
