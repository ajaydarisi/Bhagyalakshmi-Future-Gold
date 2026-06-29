"use client";

import { Link } from "@/i18n/routing";
import Image from "next/image";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/shared/price-display";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { useCart } from "@/hooks/use-cart";
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
  const { addItem } = useCart();

  const displayName = getProductName(product, locale);
  const soldOut = shouldShowSoldOutOverlay(product.stock);
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

  async function handleQuickAction(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (IS_ONLINE) {
      try {
        await addItem(product, 1);
        trackEvent("add_to_cart", {
          item_id: product.id,
          item_name: product.name,
          price: product.discount_price || product.price,
          quantity: 1,
        });
        hapticNotification("success");
        toast.success(tCart("addedToast", { name: displayName }));
      } catch {
        hapticNotification("error");
        toast.error(tCart("errorToast"));
      }
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

  return (
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

          {/* Quick action — rises on hover (desktop) / focus */}
          {!soldOut && (
            <button
              type="button"
              onClick={handleQuickAction}
              className={cn(
                "absolute inset-x-3 bottom-3 inline-flex h-[42px] items-center justify-center gap-2 rounded-full",
                "bg-ink-900 text-2xs uppercase tracking-[0.12em] text-ivory-50",
                "opacity-0 translate-y-3 pointer-events-none transition-all duration-300",
                "group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto",
                "focus-visible:opacity-100 focus-visible:translate-y-0 focus-visible:pointer-events-auto",
                "hover:bg-gold-600"
              )}
            >
              {IS_ONLINE ? <ShoppingBag className="size-3.5" /> : <MessageCircle className="size-3.5" />}
              {IS_ONLINE ? tCart("addToCart") : tWish("checkAvailability")}
            </button>
          )}
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
  );
}
