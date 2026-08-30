"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle
} from "@/components/ui/sheet";
import { useCart } from "@/hooks/use-cart";
import { ROUTES, FREE_SHIPPING_THRESHOLD } from "@/lib/constants";
import { formatPrice } from "@/lib/formatters";
import { ShoppingBag } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { CartItem } from "./cart-item";

interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CartSheet({ open, onOpenChange }: CartSheetProps) {
  const { items, subtotal, itemCount } = useCart();
  const t = useTranslations("cart");
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const freeShippingPct = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto flex h-[90vh] max-w-lg flex-col rounded-t-[1.5rem] pb-[var(--safe-area-inset-bottom)]"
      >
        {/* Drag handle */}
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-[var(--border-strong)]" />
        <SheetHeader>
          <SheetTitle>{t("sheetTitle", { count: itemCount })}</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <ShoppingBag className="mb-4 h-16 w-16 text-muted-foreground" />
            <p className="text-lg font-medium">{t("empty")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("emptySparkle")}
            </p>
            <Button asChild className="mt-4" onClick={() => onOpenChange(false)}>
              <Link href={ROUTES.products}>{t("browseProducts")}</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Free-shipping progress */}
            <div className="px-1 pb-1">
              <p className="text-xs text-text-secondary">
                {remainingForFreeShipping > 0
                  ? t("freeShippingMessage", { amount: formatPrice(remainingForFreeShipping) })
                  : t("freeShippingUnlocked")}
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-sand)]">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-[var(--ease-out)]"
                  style={{ width: `${freeShippingPct}%`, background: "var(--grad-gold)" }}
                />
              </div>
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="divide-y">
                {items.map((item) => (
                  <CartItem key={item.product.id} item={item} />
                ))}
              </div>
            </ScrollArea>

            <div className="space-y-4 pt-4">
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>{t("subtotal")}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="grid gap-2">
                <Button asChild onClick={() => onOpenChange(false)}>
                  <Link href={ROUTES.checkout}>{t("checkoutCta")}</Link>
                </Button>
                <Button
                  variant="outline"
                  asChild
                  onClick={() => onOpenChange(false)}
                >
                  <Link href={ROUTES.cart}>{t("viewCart")}</Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
