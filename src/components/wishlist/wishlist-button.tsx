"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/hooks/use-wishlist";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";

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
  const t = useTranslations("wishlist");
  const isWishlisted = isInWishlist(productId);

  async function handleToggle() {
    if (!isLoggedIn) {
      toast.info(t("signInRequired"));
      router.push(ROUTES.login);
      return;
    }

    if (isWishlisted) {
      await removeItem(productId);
      toast.success(t("removed"));
    } else {
      await addItem(productId);
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
        className="rounded-full p-2 hover:bg-muted"
      >
        <Heart
          className={cn(
            "h-5 w-5",
            isWishlisted && "fill-red-500 text-red-500"
          )}
        />
      </button>
    );
  }

  return (
    <Button variant="outline" size="lg" onClick={handleToggle}>
      <Heart
        className={cn(
          "mr-2 h-4 w-4",
          isWishlisted && "fill-red-500 text-red-500"
        )}
      />
      {isWishlisted ? t("buttoned") : t("button")}
    </Button>
  );
}
