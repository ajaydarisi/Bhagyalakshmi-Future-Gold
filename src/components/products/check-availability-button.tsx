"use client";

import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { Button } from "@/components/ui/button";
import { RentalDatesDialog } from "@/components/products/rental-dates-dialog";
import { BUSINESS_INFO } from "@/lib/constants";
import {
  buildAvailabilityMessage,
  buildRentalAvailabilityMessage,
} from "@/lib/offline-store-ui";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { trackEvent } from "@/lib/gtag";

interface CheckAvailabilityButtonProps {
  productName: string;
  productSlug: string;
  size?: "default" | "sm";
  isRental?: boolean;
  maxRentalDays?: number | null;
  /** Override the button label (e.g. "Enquire on WhatsApp" in online mode). */
  label?: string;
  /** "solid" = filled green (offline default); "outline" = secondary enquiry CTA. */
  variant?: "solid" | "outline";
}

export function CheckAvailabilityButton({
  productName,
  productSlug,
  size = "default",
  isRental,
  maxRentalDays,
  label,
  variant = "solid",
}: CheckAvailabilityButtonProps) {
  const t = useTranslations("products");
  const tw = useTranslations("wishlist");
  const [dialogOpen, setDialogOpen] = useState(false);

  function openWhatsApp(message: string) {
    trackEvent("contact_whatsapp", { item_name: productName });
    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/91${BUSINESS_INFO.whatsapp}?text=${encoded}`;

    if (Capacitor.isNativePlatform()) {
      Browser.open({ url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  function handleClick() {
    if (isRental) {
      setDialogOpen(true);
      return;
    }

    const message = buildAvailabilityMessage({
      productName,
      productSlug,
      origin: window.location.origin,
      intro: t("whatsappMessage"),
    });
    openWhatsApp(message);
  }

  function handleRentalSubmit(startDate: Date, endDate: Date) {
    const message = buildRentalAvailabilityMessage({
      productName,
      productSlug,
      origin: window.location.origin,
      intro: t("whatsappRentalMessage"),
      fromLabel: t("fromDate"),
      toLabel: t("toDate"),
      startDate,
      endDate,
    });
    openWhatsApp(message);
  }

  return (
    <>
      <Button
        className={
          variant === "outline"
            ? "w-full border border-[#006d28] bg-transparent text-[#006d28] hover:bg-[#006d28]/10 font-semibold"
            : "flex-1 bg-[#006d28] hover:bg-[#1da851] text-white font-semibold"
        }
        size={size === "sm" ? "sm" : "lg"}
        onClick={handleClick}
      >
        <MessageCircle className={size === "sm" ? "mr-1 h-3 w-3" : "mr-2 h-4 w-4"} />
        {label ?? tw("checkAvailability")}
      </Button>

      {isRental && (
        <RentalDatesDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          maxRentalDays={maxRentalDays}
          confirmLabel={t("sendOnWhatsapp")}
          confirmIcon={<MessageCircle className="mr-2 h-4 w-4" />}
          confirmClassName="bg-[#006d28] hover:bg-[#1da851] text-white"
          onConfirm={handleRentalSubmit}
        />
      )}
    </>
  );
}
