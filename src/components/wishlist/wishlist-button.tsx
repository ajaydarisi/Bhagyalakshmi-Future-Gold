"use client";

import { useState, useCallback } from "react";
import { useRouter, usePathname } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/hooks/use-wishlist";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import { trackEvent } from "@/lib/gtag";
import { hapticImpact, hapticSelection } from "@/lib/haptics";

const PARTICLES = [
  "animate-[heart-float-1_0.6s_ease-out_forwards]",
  "animate-[heart-float-2_0.5s_ease-out_0.05s_forwards]",
  "animate-[heart-float-3_0.7s_ease-out_0.1s_forwards]",
  "animate-[heart-float-4_0.55s_ease-out_0.08s_forwards]",
  "animate-[heart-float-5_0.65s_ease-out_0.03s_forwards]",
];

interface WishlistButtonProps {
  productId: string;
  variant?: "icon" | "default";
}

export function WishlistButton({
  productId,
  variant = "default",
}: WishlistButtonProps) {
  const { isInWishlist, addItem, removeItem } = useWishlist();
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("wishlist");
  const isWishlisted = isInWishlist(productId);
  const [showParticles, setShowParticles] = useState(false);

  const triggerParticles = useCallback(() => {
    setShowParticles(true);
    setTimeout(() => setShowParticles(false), 700);
  }, []);

  async function handleToggle() {
    if (!isLoggedIn) {
      toast.info(t("signInRequired"));
      router.push(`${ROUTES.login}?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (isWishlisted) {
      hapticSelection();
      await removeItem(productId);
      trackEvent("remove_from_wishlist", { item_id: productId });
      toast.success(t("removed"));
    } else {
      hapticImpact("medium");
      triggerParticles();
      await addItem(productId);
      trackEvent("add_to_wishlist", { item_id: productId });
      toast.success(t("added"));
    }
  }

  if (variant === "icon") {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleToggle();
        }}
        className="relative rounded-full p-2 border border-transparent hover:border-red-500"
        aria-label={isWishlisted ? t("removeFromWishlist") : t("addToWishlist")}
      >
        <Heart
          className={cn(
            "h-5 w-5 transition-colors",
            isWishlisted
              ? "fill-red-500 text-red-500 animate-[heart-pop_0.3s_ease-out]"
              : "text-red-500"
          )}
        />
        {showParticles && PARTICLES.map((anim, i) => (
          <Heart
            key={i}
            className={cn("pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 fill-red-500 text-red-500", anim)}
          />
        ))}
      </button>
    );
  }

  return (
    <Button variant="outline" size="lg" onClick={handleToggle} className="relative overflow-visible">
      <Heart
        className={cn(
          "mr-2 h-4 w-4 transition-colors",
          isWishlisted && "fill-red-500 text-red-500 animate-[heart-pop_0.3s_ease-out]"
        )}
      />
      {isWishlisted ? t("buttoned") : t("button")}
      {showParticles && PARTICLES.map((anim, i) => (
        <Heart
          key={i}
          className={cn("pointer-events-none absolute left-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 fill-red-500 text-red-500", anim)}
        />
      ))}
    </Button>
  );
}
