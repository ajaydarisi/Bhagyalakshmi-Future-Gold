"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BUSINESS_INFO } from "@/lib/constants";
import { Loader2, MessageCircle } from "lucide-react";

interface CheckAvailabilityButtonProps {
  productName: string;
  productImage?: string;
  size?: "default" | "sm";
}

export function CheckAvailabilityButton({
  productName,
  productImage,
  size = "default",
}: CheckAvailabilityButtonProps) {
  const [isSharing, setIsSharing] = useState(false);

  async function handleClick() {
    const message = `Hi, is this available?\n\n*${productName}*`;

    // Try Web Share API with image file (requires HTTPS — works in production)
    if (productImage && navigator.share && navigator.canShare) {
      setIsSharing(true);
      try {
        const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(productImage)}`;
        const response = await fetch(proxyUrl);

        if (response.ok) {
          const blob = await response.blob();
          const ext = blob.type.split("/")[1] || "jpg";
          const file = new File([blob], `${productName}.${ext}`, {
            type: blob.type,
          });

          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              text: message,
              files: [file],
            });
            setIsSharing(false);
            return;
          }
        }
      } catch (error) {
        // User cancelled share — don't fall through
        if (error instanceof Error && error.name === "AbortError") {
          setIsSharing(false);
          return;
        }
      }
      setIsSharing(false);
    }

    // Fallback: open wa.me text-only link (HTTP / unsupported browsers)
    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/91${BUSINESS_INFO.whatsapp}?text=${encoded}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Button
      className="flex-1 bg-[#006d28] hover:bg-[#1da851] text-white font-semibold"
      size={size === "sm" ? "sm" : "lg"}
      onClick={handleClick}
      disabled={isSharing}
    >
      {isSharing ? (
        <Loader2 className={size === "sm" ? "mr-1 h-3 w-3 animate-spin" : "mr-2 h-4 w-4 animate-spin"} />
      ) : (
        <MessageCircle className={size === "sm" ? "mr-1 h-3 w-3" : "mr-2 h-4 w-4"} />
      )}
      Check Availability
    </Button>
  );
}
