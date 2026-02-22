"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./use-auth";

interface WishlistContextType {
  items: string[]; // product IDs
  isLoading: boolean;
  addItem: (productId: string) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
}

export const WishlistContext = createContext<WishlistContextType | null>(null);

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}

export function useWishlistProvider(initialItems?: string[]): WishlistContextType {
  const [items, setItems] = useState<string[]>(initialItems ?? []);
  const [isLoading, setIsLoading] = useState(!initialItems);
  const { user, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  const fetchWishlist = useCallback(async () => {
    if (!user) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    const { data } = await supabase
      .from("wishlist_items")
      .select("product_id")
      .eq("user_id", user.id);

    setItems(data?.map((i) => i.product_id) || []);
    setIsLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    if (!authLoading) {
      fetchWishlist();
    }
  }, [authLoading, fetchWishlist]);

  const addItem = useCallback(
    async (productId: string) => {
      if (!user) return;
      setItems((prev) => [...prev, productId]);
      await supabase
        .from("wishlist_items")
        .insert({ user_id: user.id, product_id: productId });
    },
    [user, supabase]
  );

  const removeItem = useCallback(
    async (productId: string) => {
      if (!user) return;
      setItems((prev) => prev.filter((id) => id !== productId));
      await supabase
        .from("wishlist_items")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId);
    },
    [user, supabase]
  );

  const isInWishlist = useCallback(
    (productId: string) => items.includes(productId),
    [items]
  );

  return { items, isLoading, addItem, removeItem, isInWishlist };
}
