"use client";

import { formatPrice, calculateDiscount } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface PriceDisplayProps {
  price: number;
  discountPrice?: number | null;
  size?: "sm" | "md" | "lg";
}

export function PriceDisplay({
  price,
  discountPrice,
  size = "md",
}: PriceDisplayProps) {
  const t = useTranslations();
  const discount = calculateDiscount(price, discountPrice ?? null);
  const hasDiscount = discount !== null && discountPrice;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span
        className={cn(
          "font-bold",
          size === "sm" && "text-sm",
          size === "md" && "text-lg",
          size === "lg" && "text-2xl"
        )}
      >
        {formatPrice(hasDiscount ? discountPrice : price)}
      </span>
      {hasDiscount && (
        <>
          <span
            className={cn(
              "text-muted-foreground line-through",
              size === "sm" && "text-xs",
              size === "md" && "text-sm",
              size === "lg" && "text-base"
            )}
          >
            {formatPrice(price)}
          </span>
          <Badge variant="destructive" className="text-xs">
            {t("discountOff", { discount })}
          </Badge>
        </>
      )}
    </div>
  );
}
