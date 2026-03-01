"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./use-auth";
import { useNetwork } from "./use-network";

interface WishlistContextType {
  items: string[]; // product IDs
  isLoading: boolean;
  addItem: (productId: string) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
}

const WISHLIST_STORAGE_KEY = "bfg-wishlist";

export const WishlistContext = createContext<WishlistContextType | null>(null);

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}

function getLocalWishlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalWishlist(items: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
}

const supabase = createClient();

export function useWishlistProvider(): WishlistContextType {
  const [items, setItems] = useState<string[]>([]);
  const [fetchCount, setFetchCount] = useState(0);
  const { user, isLoading: authLoading } = useAuth();
  const { isOnline } = useNetwork();
  const prevUserIdRef = useRef<string | undefined>(undefined);
  const prevIsOnlineRef = useRef(true);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Derive loading: still loading until at least one fetch cycle completes
  const isLoading = authLoading || fetchCount === 0;

  const fetchFromDB = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("wishlist_items")
        .select("product_id")
        .eq("user_id", userId);

      if (error) throw error;

      const productIds = data?.map((i: { product_id: string }) => i.product_id) || [];
      setItems(productIds);
      setLocalWishlist(productIds);
    } catch {
      // Network error — fall back to localStorage
      const localItems = getLocalWishlist();
      setItems(localItems);
    }
    setFetchCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const userId = user?.id;
    if (userId === prevUserIdRef.current) return;
    prevUserIdRef.current = userId;

    if (!userId) {
      // Resolve immediately via microtask so setState is in a callback, not synchronous
      Promise.resolve().then(() => {
        setItems([]);
        setFetchCount((c) => c + 1);
      });
      return;
    }

    let cancelled = false;

    fetchFromDB(userId).then(() => {
      if (cancelled) return;
    });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, fetchFromDB]);

  // Sync on reconnect: when isOnline transitions false → true
  useEffect(() => {
    if (isOnline && !prevIsOnlineRef.current && user) {
      // Just came back online — sync local wishlist to DB
      const localItems = itemsRef.current;

      supabase
        .from("wishlist_items")
        .select("product_id")
        .eq("user_id", user.id)
        .then(({ data }: { data: { product_id: string }[] | null }) => {
          const dbIds = new Set(data?.map((i) => i.product_id) || []);
          const localIds = new Set(localItems);

          // Add items that are local but not in DB
          const toAdd = localItems.filter((id) => !dbIds.has(id));
          // Remove items that are in DB but not local
          const toRemove = [...dbIds].filter((id) => !localIds.has(id));

          const promises: Promise<unknown>[] = [];

          if (toAdd.length > 0) {
            promises.push(
              supabase
                .from("wishlist_items")
                .upsert(
                  toAdd.map((product_id) => ({ user_id: user.id, product_id })),
                  { onConflict: "user_id,product_id" },
                ),
            );
          }

          for (const id of toRemove) {
            promises.push(
              supabase
                .from("wishlist_items")
                .delete()
                .eq("user_id", user.id)
                .eq("product_id", id),
            );
          }

          return Promise.all(promises);
        })
        .then(() => fetchFromDB(user.id))
        .catch(() => {});
    }
    prevIsOnlineRef.current = isOnline;
  }, [isOnline, user, fetchFromDB]);

  // Sync on app resume
  useEffect(() => {
    const handler = () => {
      if (user && isOnline) {
        fetchFromDB(user.id);
      }
    };
    window.addEventListener("bfg:app-resume", handler);
    return () => window.removeEventListener("bfg:app-resume", handler);
  }, [user, isOnline, fetchFromDB]);

  const addItem = useCallback(
    async (productId: string) => {
      if (!user) return;
      setItems((prev) => [...prev, productId]);

      try {
        await supabase
          .from("wishlist_items")
          .insert({ user_id: user.id, product_id: productId });
        setLocalWishlist(itemsRef.current);
      } catch {
        // Offline — persist locally
        setLocalWishlist(itemsRef.current);
      }
    },
    [user]
  );

  const removeItem = useCallback(
    async (productId: string) => {
      if (!user) return;
      setItems((prev) => prev.filter((id) => id !== productId));

      try {
        await supabase
          .from("wishlist_items")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);
        setLocalWishlist(itemsRef.current);
      } catch {
        // Offline — persist locally
        setLocalWishlist(itemsRef.current);
      }
    },
    [user]
  );

  const isInWishlist = useCallback(
    (productId: string) => items.includes(productId),
    [items]
  );

  return { items, isLoading, addItem, removeItem, isInWishlist };
}
