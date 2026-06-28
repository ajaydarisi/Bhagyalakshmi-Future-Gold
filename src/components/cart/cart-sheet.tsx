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
import { ROUTES } from "@/lib/constants";
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("sheetTitle", { count: itemCount })}</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <ShoppingBag className="mb-4 h-16 w-16 text-muted-foreground" />
            <p className="text-lg font-medium">{t("empty")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("emptyDescription")}
            </p>
            <Button asChild className="mt-4" onClick={() => onOpenChange(false)}>
              <Link href={ROUTES.products}>{t("browseProducts")}</Link>
            </Button>
          </div>
        ) : (
          <>
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
                <Button variant="gold" asChild onClick={() => onOpenChange(false)}>
                  <Link href={ROUTES.checkout}>{t("proceedToCheckout")}</Link>
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
