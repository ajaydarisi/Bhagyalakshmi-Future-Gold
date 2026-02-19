"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/hooks/use-wishlist";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Heart } from "lucide-react";
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
  const isWishlisted = isInWishlist(productId);

  async function handleToggle() {
    if (!isLoggedIn) {
      toast.info("Please sign in to add items to your wishlist");
      router.push(ROUTES.login);
      return;
    }

    if (isWishlisted) {
      await removeItem(productId);
      toast.success("Removed from wishlist");
    } else {
      await addItem(productId);
      toast.success("Added to wishlist");
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
      {isWishlisted ? "Wishlisted" : "Wishlist"}
    </Button>
  );
}
