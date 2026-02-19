"use client";

import { WishlistContext, useWishlistProvider } from "@/hooks/use-wishlist";

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const wishlist = useWishlistProvider();
  return (
    <WishlistContext.Provider value={wishlist}>
      {children}
    </WishlistContext.Provider>
  );
}
