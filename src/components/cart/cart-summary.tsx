"use client";

import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/formatters";
import { Separator } from "@/components/ui/separator";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_COST } from "@/lib/constants";
import { useTranslations } from "next-intl";

interface CartSummaryProps {
  discount?: number;
  showShipping?: boolean;
}

export function CartSummary({ discount = 0, showShipping = true }: CartSummaryProps) {
  const t = useTranslations("cart");
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
        <span className="text-muted-foreground">{t("subtotal")}</span>
        <span>{formatPrice(subtotal)}</span>
      </div>
      {discount > 0 && (
        <div className="flex justify-between text-sm text-green-600">
          <span>{t("discount")}</span>
          <span>-{formatPrice(discount)}</span>
        </div>
      )}
      {showShipping && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("shipping")}</span>
          <span>
            {subtotal === 0
              ? "-"
              : shipping === 0
                ? t("free")
                : formatPrice(shipping)}
          </span>
        </div>
      )}
      {showShipping && subtotal > 0 && subtotal < FREE_SHIPPING_THRESHOLD && (
        <div className="space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%`,
                background: "var(--bfg-grad-gold)",
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("freeShippingMessage", { amount: formatPrice(FREE_SHIPPING_THRESHOLD - subtotal) })}
          </p>
        </div>
      )}
      <Separator />
      <div className="flex justify-between font-semibold">
        <span>{t("total")}</span>
        <span>{formatPrice(total)}</span>
      </div>
    </div>
  );
}
