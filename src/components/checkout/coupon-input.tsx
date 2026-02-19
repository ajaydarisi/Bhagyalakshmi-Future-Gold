"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { applyCoupon } from "@/app/(store)/checkout/actions";
import { formatPrice } from "@/lib/formatters";
import { toast } from "sonner";
import { Loader2, Tag, X } from "lucide-react";

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
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleApply() {
    if (!code.trim()) return;
    setIsLoading(true);
    try {
      const result = await applyCoupon(code, subtotal);
      onApply(result.code, result.discountAmount);
      toast.success(`Coupon applied! You save ${formatPrice(result.discountAmount)}`);
      setCode("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid coupon");
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
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Input
        placeholder="Enter coupon code"
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
          "Apply"
        )}
      </Button>
    </div>
  );
}
