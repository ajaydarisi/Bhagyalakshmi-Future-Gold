"use client";

import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/formatters";
import { Separator } from "@/components/ui/separator";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_COST } from "@/lib/constants";

interface CartSummaryProps {
  discount?: number;
  showShipping?: boolean;
}

export function CartSummary({ discount = 0, showShipping = true }: CartSummaryProps) {
  const { subtotal } = useCart();

  const shipping =
    showShipping && subtotal > 0
      ? subtotal >= FREE_SHIPPING_THRESHOLD
        ? 0
        : SHIPPING_COST
      : 0;
  const total = subtotal - discount + shipping;

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span>{formatPrice(subtotal)}</span>
      </div>
      {discount > 0 && (
        <div className="flex justify-between text-sm text-green-600">
          <span>Discount</span>
          <span>-{formatPrice(discount)}</span>
        </div>
      )}
      {showShipping && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Shipping</span>
          <span>
            {subtotal === 0
              ? "-"
              : shipping === 0
                ? "Free"
                : formatPrice(shipping)}
          </span>
        </div>
      )}
      {showShipping && subtotal > 0 && subtotal < FREE_SHIPPING_THRESHOLD && (
        <p className="text-xs text-muted-foreground">
          Add {formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)} more for free
          shipping
        </p>
      )}
      <Separator />
      <div className="flex justify-between font-semibold">
        <span>Total</span>
        <span>{formatPrice(total)}</span>
      </div>
    </div>
  );
}
