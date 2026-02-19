"use client";

import { CartContext, useCartProvider } from "@/hooks/use-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const cart = useCartProvider();

  return <CartContext.Provider value={cart}>{children}</CartContext.Provider>;
}
