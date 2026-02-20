"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";
import { Loader2, Minus, Plus, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Product } from "@/types/product";

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
      toast.success(t("addedToast", { name: product.name }));
      setQuantity(1);
    } catch {
      toast.error(t("errorToast"));
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="flex items-center rounded-md border">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-none"
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          disabled={quantity <= 1}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-10 text-center text-sm font-medium">{quantity}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-none"
          onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
          disabled={quantity >= product.stock}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <Button
        className="flex-1"
        size="lg"
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
