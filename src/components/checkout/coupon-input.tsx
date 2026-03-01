"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { applyCoupon } from "@/app/[locale]/(store)/checkout/actions";
import { formatPrice } from "@/lib/formatters";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Tag, X } from "lucide-react";
import { trackEvent } from "@/lib/gtag";
import { hapticNotification, hapticSelection } from "@/lib/haptics";

interface CouponInputProps {
  subtotal: number;
  onApply: (code: string, discount: number) => void;
  onRemove: () => void;
  appliedCoupon: { code: string; discount: number } | null;
}

export function CouponInput({
  subtotal,
  onApply,
  onRemove,
  appliedCoupon,
}: CouponInputProps) {
  const t = useTranslations("cart.checkout");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleApply() {
    if (!code.trim()) return;
    setIsLoading(true);
    try {
      const result = await applyCoupon(code, subtotal);
      onApply(result.code, result.discountAmount);
      trackEvent("apply_coupon", { coupon_code: result.code, discount: result.discountAmount });
      hapticNotification("success");
      toast.success(t("couponSuccess", { amount: formatPrice(result.discountAmount) }));
      setCode("");
    } catch (error) {
      hapticNotification("error");
      toast.error(error instanceof Error ? error.message : t("couponInvalid"));
    } finally {
      setIsLoading(false);
    }
  }

  if (appliedCoupon) {
    return (
      <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">
            {appliedCoupon.code}
          </span>
          <Badge variant="secondary" className="text-xs">
            -{formatPrice(appliedCoupon.discount)}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => { hapticSelection(); onRemove(); }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Input
        placeholder={t("couponPlaceholder")}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        className="flex-1"
      />
      <Button
        variant="outline"
        onClick={handleApply}
        disabled={isLoading || !code.trim()}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          t("couponApply")
        )}
      </Button>
    </div>
  );
}
