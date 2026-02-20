"use client";

import { Button } from "@/components/ui/button";
import { BUSINESS_INFO } from "@/lib/constants";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";

interface CheckAvailabilityButtonProps {
  productName: string;
  productSlug: string;
  size?: "default" | "sm";
}

export function CheckAvailabilityButton({
  productName,
  productSlug,
  size = "default",
}: CheckAvailabilityButtonProps) {
  const t = useTranslations("products");
  const tw = useTranslations("wishlist");

  function handleClick() {
    const previewUrl = `${window.location.origin}/preview/${productSlug}`;
    const message = `${t("whatsappMessage")}\n\n*${productName}*\n${previewUrl}`;

    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/91${BUSINESS_INFO.whatsapp}?text=${encoded}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Button
      className="flex-1 bg-[#006d28] hover:bg-[#1da851] text-white font-semibold"
      size={size === "sm" ? "sm" : "lg"}
      onClick={handleClick}
    >
      <MessageCircle className={size === "sm" ? "mr-1 h-3 w-3" : "mr-2 h-4 w-4"} />
      {tw("checkAvailability")}
    </Button>
  );
}
