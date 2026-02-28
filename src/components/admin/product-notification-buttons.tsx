"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingDown, Sparkles, PackageCheck, Loader2 } from "lucide-react";

const PRODUCT_NOTIFICATIONS = [
  {
    type: "price_drop",
    label: "Price Drop",
    icon: TrendingDown,
    confirmMessage: "Send a price drop notification to all users?",
  },
  {
    type: "new_product",
    label: "New Product",
    icon: Sparkles,
    confirmMessage: "Send a new product notification to all users?",
  },
  {
    type: "back_in_stock",
    label: "Back in Stock",
    icon: PackageCheck,
    confirmMessage: "Send a back in stock notification to all users?",
  },
] as const;

interface ProductNotificationButtonsProps {
  productId: string;
  productName: string;
}

export function ProductNotificationButtons({
  productId,
  productName,
}: ProductNotificationButtonsProps) {
  const [sendingType, setSendingType] = useState<string | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  async function handleSend(type: string, confirmMessage: string) {
    if (!confirm(`${confirmMessage}\n\nProduct: ${productName}`)) return;

    setSendingType(type);
    setResult(null);

    try {
      const res = await fetch("/api/notifications/send-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, type }),
      });

      if (res.ok) {
        setResult({ success: true, message: "Notification sent!" });
      } else {
        const data = await res.json();
        setResult({ success: false, message: data.error || "Failed to send" });
      }
    } catch {
      setResult({ success: false, message: "Network error" });
    } finally {
      setSendingType(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Notification</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {PRODUCT_NOTIFICATIONS.map((n) => (
          <Button
            key={n.type}
            variant="outline"
            className="w-full justify-start"
            disabled={sendingType !== null}
            onClick={() => handleSend(n.type, n.confirmMessage)}
          >
            {sendingType === n.type ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <n.icon className="mr-2 size-4" />
            )}
            {n.label}
          </Button>
        ))}
        {result && (
          <p
            className={`text-sm ${
              result.success ? "text-green-600" : "text-red-600"
            }`}
          >
            {result.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
