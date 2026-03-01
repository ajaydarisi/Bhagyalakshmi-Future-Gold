"use client";

import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { shareProduct } from "@/lib/share";
import { hapticImpact } from "@/lib/haptics";
import { trackEvent } from "@/lib/gtag";

interface ShareButtonProps {
  productName: string;
  productSlug: string;
  variant?: "icon" | "default";
}

export function ShareButton({
  productName,
  productSlug,
  variant = "default",
}: ShareButtonProps) {
  const t = useTranslations("products.share");

  async function handleShare() {
    hapticImpact("light");
    trackEvent("share_product", {
      item_name: productName,
      item_slug: productSlug,
    });

    const previewUrl = `${window.location.origin}/preview/${productSlug}`;
    const result = await shareProduct({
      title: productName,
      text: t("shareText", { name: productName }),
      url: previewUrl,
    });

    switch (result) {
      case "shared":
        toast.success(t("shared"));
        break;
      case "copied":
        toast.success(t("copiedToClipboard"));
        break;
      case "dismissed":
        break;
      case "failed":
        toast.error(t("shareFailed"));
        break;
    }
  }

  if (variant === "icon") {
    return (
      <button
        onClick={handleShare}
        className="rounded-full p-2 border border-transparent hover:border-primary/50 hover:bg-accent transition-colors"
        aria-label={t("shareProduct")}
      >
        <Share2 className="h-5 w-5 text-muted-foreground" />
      </button>
    );
  }

  return (
    <Button variant="outline" size="lg" onClick={handleShare}>
      <Share2 className="mr-2 h-4 w-4" />
      {t("button")}
    </Button>
  );
}
