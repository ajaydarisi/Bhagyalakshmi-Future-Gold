"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./use-auth";
import type { Product } from "@/types/product";
import type { CartItem } from "@/types/cart";

interface CartContextType {
  items: CartItem[];
  isLoading: boolean;
  itemCount: number;
  subtotal: number;
  addItem: (product: Product, quantity?: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

const CART_STORAGE_KEY = "sparkle-cart";

export const CartContext = createContext<CartContextType | null>(null);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

function getLocalCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setLocalCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

export function useCartProvider(): CartContextType {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  const fetchCartFromDB = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("cart_items")
      .select("id, quantity, product_id, product:products(*)")
      .eq("user_id", user.id);

    if (data) {
      const cartItems: CartItem[] = data
        .filter((item) => item.product)
        .map((item) => ({
          id: item.id,
          product: item.product as unknown as Product,
          quantity: item.quantity,
        }));
      setItems(cartItems);
    }
  }, [user, supabase]);

  // Merge local cart into DB on login
  const mergeLocalCartToDB = useCallback(async () => {
    if (!user) return;
    const localItems = getLocalCart();
    if (localItems.length === 0) return;

    for (const item of localItems) {
      await supabase.from("cart_items").upsert(
        {
          user_id: user.id,
          product_id: item.product.id,
          quantity: item.quantity,
        },
        { onConflict: "user_id,product_id" }
      );
    }

    localStorage.removeItem(CART_STORAGE_KEY);
    await fetchCartFromDB();
  }, [user, supabase, fetchCartFromDB]);

  // Initialize cart
  useEffect(() => {
    if (authLoading) return;

    if (user) {
      mergeLocalCartToDB().then(() => fetchCartFromDB()).finally(() => setIsLoading(false));
    } else {
      setItems(getLocalCart());
      setIsLoading(false);
    }
  }, [user, authLoading, fetchCartFromDB, mergeLocalCartToDB]);

  const addItem = useCallback(
    async (product: Product, quantity = 1) => {
      const existing = items.find((i) => i.product.id === product.id);

      if (user) {
        if (existing) {
          await supabase
            .from("cart_items")
            .update({ quantity: existing.quantity + quantity })
            .eq("user_id", user.id)
            .eq("product_id", product.id);
        } else {
          await supabase
            .from("cart_items")
            .insert({ user_id: user.id, product_id: product.id, quantity });
        }
        await fetchCartFromDB();
      } else {
        let newItems: CartItem[];
        if (existing) {
          newItems = items.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: i.quantity + quantity }
              : i
          );
        } else {
          newItems = [
            ...items,
            { id: crypto.randomUUID(), product, quantity },
          ];
        }
        setItems(newItems);
        setLocalCart(newItems);
      }
    },
    [items, user, supabase, fetchCartFromDB]
  );

  const updateQuantity = useCallback(
    async (productId: string, quantity: number) => {
      if (quantity <= 0) {
        await removeItem(productId);
        return;
      }

      if (user) {
        await supabase
          .from("cart_items")
          .update({ quantity })
          .eq("user_id", user.id)
          .eq("product_id", productId);
        await fetchCartFromDB();
      } else {
        const newItems = items.map((i) =>
          i.product.id === productId ? { ...i, quantity } : i
        );
        setItems(newItems);
        setLocalCart(newItems);
      }
    },
    [items, user, supabase, fetchCartFromDB]
  );

  const removeItem = useCallback(
    async (productId: string) => {
      if (user) {
        await supabase
          .from("cart_items")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);
        await fetchCartFromDB();
      } else {
        const newItems = items.filter((i) => i.product.id !== productId);
        setItems(newItems);
        setLocalCart(newItems);
      }
    },
    [items, user, supabase, fetchCartFromDB]
  );

  const clearCart = useCallback(async () => {
    if (user) {
      await supabase.from("cart_items").delete().eq("user_id", user.id);
      setItems([]);
    } else {
      setItems([]);
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  }, [user, supabase]);

  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, i) =>
          sum + (i.product.discount_price || i.product.price) * i.quantity,
        0
      ),
    [items]
  );

  return {
    items,
    isLoading,
    itemCount,
    subtotal,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
  };
}
