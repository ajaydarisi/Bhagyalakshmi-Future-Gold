"use client";

import { createClient } from "@/lib/supabase/client";
import type { CartItem } from "@/types/cart";
import type { Product } from "@/types/product";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./use-auth";
import { useNetwork } from "./use-network";
import { enqueue, replayQueue } from "@/lib/operation-queue";
import { getCartLineUnitPrice } from "@/lib/product-pricing";

interface CartContextType {
  items: CartItem[];
  isLoading: boolean;
  itemCount: number;
  subtotal: number;
  addItem: (
    product: Product,
    quantity?: number,
    rental?: { start: string; end: string },
  ) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

const CART_STORAGE_KEY = "bhagylakshmi-future-gold-cart";

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

const supabase = createClient();

export function useCartProvider(): CartContextType {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isLoading: authLoading } = useAuth();
  const { isOnline } = useNetwork();
  // undefined = "not initialized yet" — null must stay distinct so the
  // guest (userId === null) first run isn't skipped by the dedup guard below.
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  const prevIsOnlineRef = useRef(true);
  // Use ref for stable access to items in callbacks without re-creating them
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const fetchCartFromDB = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("cart_items")
        .select("id, quantity, product_id, rental_start, rental_end, product:products(*)")
        .eq("user_id", userId);

      if (error) throw error;

      if (data) {
        const cartItems: CartItem[] = (data as { id: string; quantity: number; product_id: string; rental_start: string | null; rental_end: string | null; product: unknown }[])
          .filter((item) => item.product)
          .map((item) => ({
            id: item.id,
            product: item.product as Product,
            quantity: item.quantity,
            rental_start: item.rental_start,
            rental_end: item.rental_end,
          }));
        setItems(cartItems);
        // Keep localStorage snapshot for offline fallback
        setLocalCart(cartItems);
      }
    } catch {
      // Network error — fall back to localStorage snapshot
      const localItems = getLocalCart();
      if (localItems.length > 0) {
        setItems(localItems);
      }
    }
  }, []);

  // Refresh product prices in cart items from database
  const refreshCartPrices = useCallback(async () => {
    const currentItems = itemsRef.current;
    if (currentItems.length === 0) return;

    try {
      const productIds = currentItems.map((i) => i.product.id);
      const { data } = await supabase
        .from("products")
        .select("id, price, discount_price, stock, is_sale, is_rental, rental_price, rental_discount_price")
        .in("id", productIds);

      if (!data || data.length === 0) return;

      type FreshPrice = {
        id: string;
        price: number;
        discount_price: number | null;
        stock: number;
        is_sale: boolean;
        is_rental: boolean;
        rental_price: number | null;
        rental_discount_price: number | null;
      };
      const priceMap = new Map<string, FreshPrice>(
        (data as FreshPrice[]).map((p) => [p.id, p]),
      );

      const updated = currentItems.map((item) => {
        const fresh = priceMap.get(item.product.id);
        if (!fresh) return item;
        return {
          ...item,
          product: {
            ...item.product,
            price: fresh.price,
            discount_price: fresh.discount_price,
            stock: fresh.stock,
            is_sale: fresh.is_sale,
            is_rental: fresh.is_rental,
            rental_price: fresh.rental_price,
            rental_discount_price: fresh.rental_discount_price,
          },
        };
      });

      setItems(updated);
      setLocalCart(updated);
    } catch {
      // Offline — keep existing prices
    }
  }, []);

  const mergeLocalCartToDB = useCallback(async (userId: string) => {
    const localItems = getLocalCart();
    if (localItems.length === 0) return;

    // Merge additively with the existing DB cart instead of overwriting it —
    // a plain upsert clobbers a quantity already saved on another device and
    // wipes rental dates. Sum the guest and saved quantities (capped at the
    // product's stock), and keep the guest's rental dates when present.
    const { data: existing } = await supabase
      .from("cart_items")
      .select("product_id, quantity, rental_start, rental_end")
      .eq("user_id", userId);

    type ExistingRow = {
      product_id: string;
      quantity: number;
      rental_start: string | null;
      rental_end: string | null;
    };
    const byProduct = new Map<string, ExistingRow>(
      ((existing ?? []) as ExistingRow[]).map((row) => [row.product_id, row]),
    );

    const upsertItems = localItems.map((item) => {
      const prev = byProduct.get(item.product.id);
      const summed = (prev?.quantity ?? 0) + item.quantity;
      const stock = item.product?.stock;
      return {
        user_id: userId,
        product_id: item.product.id,
        quantity: typeof stock === "number" ? Math.min(summed, stock) : summed,
        rental_start: item.rental_start ?? prev?.rental_start ?? null,
        rental_end: item.rental_end ?? prev?.rental_end ?? null,
      };
    });

    await supabase
      .from("cart_items")
      .upsert(upsertItems, { onConflict: "user_id,product_id" });

    localStorage.removeItem(CART_STORAGE_KEY);
  }, []);

  // Initialize cart
  useEffect(() => {
    if (authLoading) return;

    const userId = user?.id ?? null;
    if (userId === prevUserIdRef.current) return;
    prevUserIdRef.current = userId;

    if (userId) {
      mergeLocalCartToDB(userId)
        .then(() => fetchCartFromDB(userId))
        .finally(() => setIsLoading(false));
    } else {
      Promise.resolve().then(() => {
        const localCart = getLocalCart();
        setItems(localCart);
        setIsLoading(false);
        // Refresh prices for guest cart items if online
        if (localCart.length > 0) {
          refreshCartPrices();
        }
      });
    }
  }, [user?.id, authLoading, fetchCartFromDB, mergeLocalCartToDB, refreshCartPrices]);

  // Sync on reconnect: when isOnline transitions false → true
  useEffect(() => {
    if (isOnline && !prevIsOnlineRef.current && user) {
      // Just came back online — replay queued operations, then upsert and re-fetch
      replayQueue()
        .catch(() => {})
        .then(() => {
          const localItems = itemsRef.current;
          if (localItems.length > 0) {
            const upsertItems = localItems.map((item) => ({
              user_id: user.id,
              product_id: item.product.id,
              quantity: item.quantity,
              rental_start: item.rental_start ?? null,
              rental_end: item.rental_end ?? null,
            }));
            supabase
              .from("cart_items")
              .upsert(upsertItems, { onConflict: "user_id,product_id" })
              .then(() => fetchCartFromDB(user.id));
          } else {
            fetchCartFromDB(user.id);
          }
        });
    }
    prevIsOnlineRef.current = isOnline;
  }, [isOnline, user, fetchCartFromDB]);

  // Sync on app resume
  useEffect(() => {
    const handler = () => {
      if (!isOnline) return;
      if (user) {
        fetchCartFromDB(user.id);
      } else {
        refreshCartPrices();
      }
    };
    window.addEventListener("bfg:app-resume", handler);
    return () => window.removeEventListener("bfg:app-resume", handler);
  }, [user, isOnline, fetchCartFromDB, refreshCartPrices]);

  const addItem = useCallback(
    async (
      product: Product,
      quantity = 1,
      rental?: { start: string; end: string },
    ) => {
      const currentItems = itemsRef.current;
      const existing = currentItems.find((i) => i.product.id === product.id);

      // Optimistic update — apply immediately. Adding again with new rental
      // dates replaces the stored period (one cart line per product).
      const newItems = existing
        ? currentItems.map((i) =>
            i.product.id === product.id
              ? {
                  ...i,
                  quantity: i.quantity + quantity,
                  ...(rental
                    ? { rental_start: rental.start, rental_end: rental.end }
                    : {}),
                }
              : i,
          )
        : [
            ...currentItems,
            {
              id: crypto.randomUUID(),
              product,
              quantity,
              rental_start: rental?.start ?? null,
              rental_end: rental?.end ?? null,
            },
          ];
      setItems(newItems);

      if (!user) {
        setLocalCart(newItems);
        return;
      }

      // Persist in the background. The optimistic update is already applied, so the
      // UI must never block on this write — a stalled request would otherwise hang
      // the Add to Cart button forever. Failures fall back to the offline replay queue.
      const write = existing
        ? supabase
            .from("cart_items")
            .update({
              quantity: existing.quantity + quantity,
              ...(rental
                ? { rental_start: rental.start, rental_end: rental.end }
                : {}),
            })
            .eq("user_id", user.id)
            .eq("product_id", product.id)
        : supabase.from("cart_items").insert({
            user_id: user.id,
            product_id: product.id,
            quantity,
            rental_start: rental?.start ?? null,
            rental_end: rental?.end ?? null,
          });

      Promise.resolve(write).then(
        () => setLocalCart(newItems),
        () => {
          setLocalCart(newItems);
          enqueue(existing ? "cart-update" : "cart-add", {
            userId: user.id,
            productId: product.id,
            quantity: existing ? existing.quantity + quantity : quantity,
            rentalStart: rental?.start,
            rentalEnd: rental?.end,
          }).catch(() => {});
        },
      );
    },
    [user],
  );

  const removeItem = useCallback(
    async (productId: string) => {
      const currentItems = itemsRef.current;

      // Optimistic update
      const newItems = currentItems.filter((i) => i.product.id !== productId);
      setItems(newItems);

      if (user) {
        try {
          await supabase
            .from("cart_items")
            .delete()
            .eq("user_id", user.id)
            .eq("product_id", productId);
          setLocalCart(newItems);
        } catch {
          // Offline — persist optimistic state locally and enqueue for replay
          setLocalCart(newItems);
          enqueue("cart-remove", {
            userId: user.id,
            productId,
          }).catch(() => {});
        }
      } else {
        setLocalCart(newItems);
      }
    },
    [user],
  );

  const updateQuantity = useCallback(
    async (productId: string, quantity: number) => {
      if (quantity <= 0) {
        await removeItem(productId);
        return;
      }

      const currentItems = itemsRef.current;

      // Optimistic update
      const newItems = currentItems.map((i) =>
        i.product.id === productId ? { ...i, quantity } : i,
      );
      setItems(newItems);

      if (user) {
        try {
          await supabase
            .from("cart_items")
            .update({ quantity })
            .eq("user_id", user.id)
            .eq("product_id", productId);
          setLocalCart(newItems);
        } catch {
          // Offline — persist optimistic state locally and enqueue for replay
          setLocalCart(newItems);
          enqueue("cart-update", {
            userId: user.id,
            productId,
            quantity,
          }).catch(() => {});
        }
      } else {
        setLocalCart(newItems);
      }
    },
    [user, removeItem],
  );

  const clearCart = useCallback(async () => {
    setItems([]);

    if (user) {
      try {
        await supabase.from("cart_items").delete().eq("user_id", user.id);
      } catch {
        // Offline — enqueue for replay
        enqueue("cart-clear", { userId: user.id }).catch(() => {});
      }
    }
    localStorage.removeItem(CART_STORAGE_KEY);
  }, [user]);

  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  );

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, i) =>
          sum +
          getCartLineUnitPrice(i.product, i.rental_start, i.rental_end) *
            i.quantity,
        0,
      ),
    [items],
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
