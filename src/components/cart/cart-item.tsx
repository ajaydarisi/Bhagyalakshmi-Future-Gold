"use client";

import Image from "next/image";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { useCart } from "@/hooks/use-cart";
import { formatDate, formatPrice } from "@/lib/formatters";
import { getCartLineUnitPrice, getRentalDays } from "@/lib/product-pricing";
import { ROUTES } from "@/lib/constants";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CartItem as CartItemType } from "@/types/cart";
import { hapticNotification, hapticSelection } from "@/lib/haptics";

interface CartItemProps {
  item: CartItemType;
}

export function CartItem({ item }: CartItemProps) {
  const { updateQuantity, removeItem } = useCart();
  const t = useTranslations("products.card");
  const tCart = useTranslations("cart");
  const { product, quantity } = item;
  const price = getCartLineUnitPrice(product, item.rental_start, item.rental_end);
  const hasRentalPeriod = Boolean(item.rental_start && item.rental_end);

  return (
    <div className="flex gap-4 py-4">
      <Link
        href={ROUTES.product(product.slug)}
        className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-md bg-muted"
      >
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="96px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {t("noImage")}
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col">
        <div className="flex justify-between">
          <Link
            href={ROUTES.product(product.slug)}
            className="font-medium hover:text-primary"
          >
            {product.name}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => { hapticNotification("warning"); removeItem(product.id); }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        {product.material && (
          <p className="text-xs text-muted-foreground">{product.material}</p>
        )}
        {hasRentalPeriod && (
          <p className="text-xs text-text-gold">
            {tCart("rentalPeriod", {
              start: formatDate(item.rental_start!),
              end: formatDate(item.rental_end!),
              days: getRentalDays(item.rental_start!, item.rental_end!),
            })}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between">
          <QuantityStepper
            size="sm"
            value={quantity}
            min={1}
            max={Math.max(1, product.stock)}
            onChange={(v) => {
              hapticSelection();
              updateQuantity(product.id, v);
            }}
          />
          <span className="font-medium">{formatPrice(price * quantity)}</span>
        </div>
      </div>
    </div>
  );
}
