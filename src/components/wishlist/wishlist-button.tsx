"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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

const SPARKLES = [
  { left: "16%", top: "20%", delay: "0s" },
  { left: "82%", top: "30%", delay: "0.08s" },
  { left: "74%", top: "78%", delay: "0.14s" },
  { left: "22%", top: "72%", delay: "0.05s" },
];

interface WishlistButtonProps {
  productId: string;
  variant?: "icon" | "default";
  /** Diameter in px for the floating icon variant. */
  size?: number;
}

/** Celebratory gold sparkle burst, retriggered via `key`. */
function Sparkles({ size }: { size: number }) {
  return (
    <>
      {SPARKLES.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            left: p.left,
            top: p.top,
            width: Math.max(3, size * 0.07),
            height: Math.max(3, size * 0.07),
            background: "var(--gold-400)",
            animation: `bfg-twinkle 0.7s var(--ease-out) ${p.delay} infinite`,
          }}
        />
      ))}
    </>
  );
}

export function WishlistButton({ productId, variant = "default", size = 40 }: WishlistButtonProps) {
  const { isInWishlist, addItem, removeItem } = useWishlist();
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("wishlist");
  const isWishlisted = isInWishlist(productId);
  const [burst, setBurst] = useState(0);
  const [showSparkles, setShowSparkles] = useState(false);
  const sparkleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Blink the gold dots on wishlist, then remove them after 3s.
  const triggerBurst = useCallback(() => {
    setBurst((b) => b + 1);
    setShowSparkles(true);
    if (sparkleTimer.current) clearTimeout(sparkleTimer.current);
    sparkleTimer.current = setTimeout(() => setShowSparkles(false), 1000);
  }, []);

  useEffect(
    () => () => {
      if (sparkleTimer.current) clearTimeout(sparkleTimer.current);
    },
    []
  );

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
      triggerBurst();
      await addItem(productId);
      trackEvent("add_to_wishlist", { item_id: productId });
      toast.success(t("added"));
    }
  }

  const heart = (
    <Heart
      key={burst}
      strokeWidth={1.7}
      className={cn(
        "transition-colors",
        isWishlisted ? "fill-maroon-500 text-maroon-500" : "text-stone-600"
      )}
      style={burst ? { animation: "bfg-heart-pop 0.42s var(--ease-out)" } : undefined}
    />
  );

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleToggle();
        }}
        aria-label={isWishlisted ? t("removeFromWishlist") : t("addToWishlist")}
        aria-pressed={isWishlisted}
        className="relative inline-flex items-center justify-center rounded-full border transition-transform active:scale-90"
        style={{
          width: size,
          height: size,
          background: "rgb(252 250 246 / 0.9)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          boxShadow: "var(--shadow-sm)",
          borderColor: "var(--border-sand)",
        }}
      >
        <span className="flex h-full w-full items-center justify-center [&>svg]:size-[46%] [&>svg]:min-h-[18px] [&>svg]:min-w-[18px]">{heart}</span>
        {isWishlisted && showSparkles && <Sparkles key={`s${burst}`} size={size} />}
      </button>
    );
  }

  return (
    <Button
      variant="gold-outline"
      size="bfg-md"
      onClick={handleToggle}
      iconLeft={<span className="[&>svg]:size-4">{heart}</span>}
      className="relative overflow-visible"
    >
      {isWishlisted ? t("buttoned") : t("button")}
      {isWishlisted && showSparkles && <Sparkles key={`s${burst}`} size={28} />}
    </Button>
  );
}
