"use client";

import { createOrder, verifyPayment } from "@/app/[locale]/(store)/checkout/actions";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";
import { CreditCard, Loader2 } from "lucide-react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/gtag";
import { hapticNotification } from "@/lib/haptics";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

interface PaymentButtonProps {
  addressId: string;
  couponCode: string | null;
  userEmail: string;
  userName: string;
  onSuccess: (orderId: string) => void;
}

export function PaymentButton({
  addressId,
  couponCode,
  userEmail,
  userName,
  onSuccess,
}: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const t = useTranslations("cart.checkout.paymentButton");

  async function handlePayment() {
    setIsLoading(true);
    try {
      const { orderId, razorpayOrderId, amount } = await createOrder(
        addressId,
        couponCode
      );

      trackEvent("begin_checkout", { value: amount, currency: "INR" });

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: Math.round(amount * 100),
        currency: "INR",
        name: APP_NAME,
        description: t("description"),
        order_id: razorpayOrderId,
        prefill: {
          email: userEmail,
          name: userName,
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await verifyPayment(
              orderId,
              response.razorpay_payment_id,
              response.razorpay_order_id,
              response.razorpay_signature
            );
            trackEvent("purchase", {
              transaction_id: response.razorpay_payment_id,
              value: amount,
              currency: "INR",
            });
            hapticNotification("success");
            toast.success(t("success"));
            onSuccess(orderId);
          } catch {
            hapticNotification("error");
            toast.error(t("verifyFailed"));
          }
        },
        modal: {
          ondismiss: () => {
            hapticNotification("warning");
            trackEvent("payment_failed");
            setIsLoading(false);
            toast.info(t("cancelled"));
          },
        },
        theme: {
          color: "#18181b",
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("initFailed")
      );
      setIsLoading(false);
    }
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setScriptLoaded(true)}
      />
      <Button
        size="lg"
        className="w-full"
        onClick={handlePayment}
        disabled={isLoading || !scriptLoaded}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="mr-2 h-4 w-4" />
        )}
        {t("payNow")}
      </Button>
    </>
  );
}
