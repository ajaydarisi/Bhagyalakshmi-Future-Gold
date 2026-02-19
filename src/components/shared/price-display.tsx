import { formatPrice, calculateDiscount } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  const discount = calculateDiscount(price, discountPrice ?? null);
  const hasDiscount = discount !== null && discountPrice;

  return (
    <div className="flex items-center gap-2">
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
            {discount}% OFF
          </Badge>
        </>
      )}
    </div>
  );
}
