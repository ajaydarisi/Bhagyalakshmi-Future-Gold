"use client";

import { WishlistContext, useWishlistProvider } from "@/hooks/use-wishlist";

export function WishlistProvider({ children, initialItems }: { children: React.ReactNode; initialItems?: string[] }) {
  const wishlist = useWishlistProvider(initialItems);
  return (
    <WishlistContext.Provider value={wishlist}>
      {children}
    </WishlistContext.Provider>
  );
}
