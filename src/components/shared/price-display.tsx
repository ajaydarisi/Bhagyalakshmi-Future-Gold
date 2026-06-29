"use client";

import { formatPrice, calculateDiscount } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface PriceDisplayProps {
  price: number;
  discountPrice?: number | null;
  size?: "sm" | "md" | "lg";
  showDiscount?: boolean;
  className?: string;
}

const NOW_SIZE = { sm: "text-base", md: "text-xl", lg: "text-3xl" } as const;
const WAS_SIZE = { sm: "text-xs", md: "text-sm", lg: "text-base" } as const;

/**
 * Price with optional MRP strikethrough + computed discount.
 * Reskinned to the BFG design system: bold sans "now" price (warm ink),
 * muted strikethrough MRP, sparing maroon "% off". en-IN grouping via formatPrice.
 */
export function PriceDisplay({
  price,
  discountPrice,
  size = "md",
  showDiscount = true,
  className,
}: PriceDisplayProps) {
  const t = useTranslations();
  const discount = calculateDiscount(price, discountPrice ?? null);
  const hasDiscount = discount !== null && !!discountPrice;

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-0.5", className)}>
      <span className={cn("font-body font-semibold tracking-[-0.01em] text-text-primary", NOW_SIZE[size])}>
        {formatPrice(hasDiscount ? discountPrice! : price)}
      </span>
      {hasDiscount && (
        <span className={cn("font-body text-text-muted line-through", WAS_SIZE[size])}>
          {formatPrice(price)}
        </span>
      )}
      {hasDiscount && showDiscount && (
        <span className="text-xs font-semibold tracking-[0.02em] text-maroon-500">
          {t("discountOff", { discount })}
        </span>
      )}
    </div>
  );
}
