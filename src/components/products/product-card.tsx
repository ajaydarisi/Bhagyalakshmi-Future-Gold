"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import Image from "next/image";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/shared/price-display";
import { RentalDatesDialog } from "@/components/products/rental-dates-dialog";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { useCart } from "@/hooks/use-cart";
import { getCartLineUnitPrice, isRentalOnlyProduct } from "@/lib/product-pricing";
import { ROUTES, IS_ONLINE, BUSINESS_INFO } from "@/lib/constants";
import { getCategoryName, getProductName } from "@/lib/i18n-helpers";
import { calculateDiscount } from "@/lib/formatters";
import { shouldShowSoldOutOverlay, buildAvailabilityMessage } from "@/lib/offline-store-ui";
import { trackEvent } from "@/lib/gtag";
import { hapticNotification } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import type { ProductWithCategory } from "@/types/product";
import { ShoppingBag, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";

interface ProductCardProps {
  product: ProductWithCategory;
}

export function ProductCard({ product }: ProductCardProps) {
  const t = useTranslations("products.card");
  const td = useTranslations("products.detail");
  const tp = useTranslations("products");
  const tc = useTranslations("constants");
  const tRoot = useTranslations();
  const tCart = useTranslations("products.addToCart");
  const tWish = useTranslations("wishlist");
  const locale = useLocale();
  const { items, addItem, updateQuantity } = useCart();
  const [rentalDialogOpen, setRentalDialogOpen] = useState(false);

  const displayName = getProductName(product, locale);
  const soldOut = shouldShowSoldOutOverlay(product.stock);
  const isRentalOnly = isRentalOnlyProduct(product);

  // Inline stepper: only for online items already in the bag. For rentals the
  // quantity is the number of sets for the chosen rental period.
  const qty = items.find((i) => i.product.id === product.id)?.quantity ?? 0;
  const showStepper = IS_ONLINE && qty > 0;
  const initials = (displayName || "BFG")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  // Price model: rental products price by rental_price/day, otherwise sale price.
  const isRentalPriced = !product.is_sale && product.is_rental && !!product.rental_price;
  const basePrice = isRentalPriced ? product.rental_price! : product.price;
  const cutPrice = isRentalPriced ? product.rental_discount_price : product.discount_price;
  const discount = calculateDiscount(basePrice, cutPrice ?? null);

  async function addToCart(rental?: { start: string; end: string }) {
    try {
      await addItem(product, 1, rental);
      trackEvent("add_to_cart", {
        item_id: product.id,
        item_name: product.name,
        price: getCartLineUnitPrice(product, rental?.start, rental?.end),
        quantity: 1,
      });
      hapticNotification("success");
      toast.success(tCart("addedToast", { name: displayName }));
    } catch {
      hapticNotification("error");
      toast.error(tCart("errorToast"));
    }
  }

  async function handleQuickAction(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (IS_ONLINE) {
      // Rentals are priced per day, so a rental period must be chosen first.
      if (isRentalOnly) {
        setRentalDialogOpen(true);
        return;
      }
      await addToCart();
    } else {
      const message = buildAvailabilityMessage({
        productName: displayName,
        productSlug: product.slug,
        origin: window.location.origin,
        intro: tp("whatsappMessage"),
      });
      trackEvent("contact_whatsapp", { item_name: displayName });
      const url = `https://wa.me/91${BUSINESS_INFO.whatsapp}?text=${encodeURIComponent(message)}`;
      if (Capacitor.isNativePlatform()) Browser.open({ url });
      else window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  function handleStep(e: React.MouseEvent, next: number) {
    e.preventDefault();
    e.stopPropagation();
    void updateQuantity(product.id, Math.min(next, 10)); // capped at 10; <=0 removes
  }

  // Reveal rule (the touch fix): the CTA is fully visible by default — touch
  // devices keep it. Only pointers that can hover hide it at rest and rise it
  // in on hover/focus. Never gate the visible state behind a hover the device
  // can't produce.
  const reveal = cn(
    "opacity-100 translate-y-0 pointer-events-auto transition-all duration-300",
    "[@media(hover:hover)_and_(pointer:fine)]:opacity-0",
    "[@media(hover:hover)_and_(pointer:fine)]:translate-y-3",
    "[@media(hover:hover)_and_(pointer:fine)]:pointer-events-none",
    "[@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100",
    "[@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-y-0",
    "[@media(hover:hover)_and_(pointer:fine)]:group-hover:pointer-events-auto",
  );

  return (
    <>
    <Link href={ROUTES.product(product.slug)} className="group block">
      <article
        className={cn(
          "relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border bg-surface-card",
          "shadow-[var(--shadow-sm)] transition-all duration-300",
          "group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-lg)] group-hover:border-[var(--border-gold)]"
        )}
        style={{ borderColor: "var(--border-sand)" }}
      >
        {/* Image */}
        <div className="relative aspect-4/5 overflow-hidden bg-sand-200">
          {product.images[0] ? (
            <Image
              src={product.images[0]}
              alt={displayName}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={cn(
                "object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.06]",
                soldOut && "grayscale-[0.4] opacity-70"
              )}
            />
          ) : (
            <div
              className="absolute inset-0 grid place-items-center transition-transform duration-700 group-hover:scale-[1.04]"
              style={{ background: "var(--grad-gold-soft)" }}
            >
              <span
                className="bfg-foil font-display font-bold"
                style={{ fontSize: "2.4rem", letterSpacing: "0.06em", opacity: 0.9 }}
              >
                {initials}
              </span>
            </div>
          )}

          {/* Badges (top-left) */}
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {discount !== null && (
              <Badge variant="sale" size="sm">
                {tRoot("discountOff", { discount })}
              </Badge>
            )}
            {product.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="gold" size="sm">
                {tc(`tags.${tag}`)}
              </Badge>
            ))}
            {product.is_rental && (
              <Badge variant="rental" size="sm">
                {td("forRent")}
              </Badge>
            )}
          </div>

          {/* Wishlist (top-right) */}
          <div className="absolute right-3 top-3" onClick={(e) => e.preventDefault()}>
            <WishlistButton productId={product.id} variant="icon" size={38} />
          </div>

          {/* Sold out overlay */}
          {soldOut && (
            <div className="absolute inset-0 grid place-items-center" style={{ background: "rgb(28 24 18 / 0.28)" }}>
              <span className="rounded-full bg-ink-900 px-3.5 py-1.5 text-2xs uppercase tracking-[0.18em] text-ivory-50">
                {t("soldOut")}
              </span>
            </div>
          )}

          {/* Quick action — always visible on touch; rises on hover (desktop)
              / focus. Morphs into an inline qty stepper once in the bag. */}
          {!soldOut &&
            (showStepper ? (
              <div
                onClick={(e) => e.preventDefault()}
                className={cn(
                  "absolute inset-x-3 bottom-3 flex h-[42px] items-center justify-between rounded-full text-ink-900",
                  reveal
                )}
                style={{ background: "var(--grad-gold)", boxShadow: "var(--shadow-gold)" }}
              >
                <button
                  type="button"
                  aria-label={t("decreaseQuantity")}
                  onClick={(e) => handleStep(e, qty - 1)}
                  className="grid size-[42px] flex-shrink-0 place-items-center text-base leading-none"
                >
                  &#8722;
                </button>
                <span className="min-w-6 text-center text-sm font-medium tabular-nums">{qty}</span>
                <button
                  type="button"
                  aria-label={t("increaseQuantity")}
                  onClick={(e) => handleStep(e, qty + 1)}
                  className="grid size-[42px] flex-shrink-0 place-items-center text-base leading-none"
                >
                  &#43;
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleQuickAction}
                className={cn(
                  "absolute inset-x-3 bottom-3 inline-flex h-[42px] items-center justify-center gap-2 rounded-full",
                  "bg-ink-900 text-2xs uppercase tracking-[0.12em] text-ivory-50",
                  "focus-visible:opacity-100 focus-visible:translate-y-0 focus-visible:pointer-events-auto",
                  "hover:bg-gold-600",
                  reveal
                )}
              >
                {IS_ONLINE ? <ShoppingBag className="size-3.5" /> : <MessageCircle className="size-3.5" />}
                {IS_ONLINE
                  ? !product.is_sale && product.is_rental
                    ? t("rentNow")
                    : tCart("addToCart")
                  : tWish("checkAvailability")}
              </button>
            ))}
        </div>

        {/* Body */}
        <div className="flex flex-col gap-2 p-4">
          {product.category && (
            <span className="text-2xs uppercase tracking-[0.1em] text-text-gold">
              {getCategoryName(product.category, locale)}
            </span>
          )}
          <h3 className="line-clamp-2 font-body text-base font-semibold leading-snug text-text-primary">
            {displayName}
          </h3>
          {product.set_number && (
            <p className="text-xs text-text-secondary">{td("setNumber", { number: product.set_number })}</p>
          )}
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1">
            <PriceDisplay price={basePrice} discountPrice={cutPrice} size="md" showDiscount={false} />
            {isRentalPriced && <span className="text-xs text-text-secondary">{td("perDay")}</span>}
          </div>
        </div>
      </article>
    </Link>
    {IS_ONLINE && isRentalOnly && (
      <RentalDatesDialog
        open={rentalDialogOpen}
        onOpenChange={setRentalDialogOpen}
        maxRentalDays={product.max_rental_days}
        productId={product.id}
        confirmLabel={t("rentNow")}
        confirmIcon={<ShoppingBag className="mr-2 h-4 w-4" />}
        onConfirm={(start, end) =>
          void addToCart({
            start: format(start, "yyyy-MM-dd"),
            end: format(end, "yyyy-MM-dd"),
          })
        }
      />
    )}
    </>
  );
}
