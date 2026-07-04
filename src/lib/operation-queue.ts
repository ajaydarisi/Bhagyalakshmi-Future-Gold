import { idbGetAll, idbPut, idbDelete, idbClear } from "./idb-helpers";
import { createClient } from "@/lib/supabase/client";

const STORE = "pending-ops";

export type OperationType =
  | "cart-add"
  | "cart-update"
  | "cart-remove"
  | "cart-clear"
  | "wishlist-add"
  | "wishlist-remove";

export interface QueuedOperation {
  id: string;
  type: OperationType;
  payload: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
}

export async function enqueue(
  type: OperationType,
  payload: Record<string, unknown>,
): Promise<string> {
  const id = crypto.randomUUID();
  const op: QueuedOperation = {
    id,
    type,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: 5,
  };

  await idbPut(STORE, op);

  // Register Background Sync if supported
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      // Background Sync API types not in standard TS lib
      const syncReg = reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } };
      await syncReg.sync.register("bfg-sync-mutations");
    } catch {
      // Background Sync not available — replay will happen on reconnect
    }
  }

  return id;
}

export async function dequeueAll(): Promise<QueuedOperation[]> {
  const ops = await idbGetAll<QueuedOperation>(STORE);
  return ops.sort((a, b) => a.createdAt - b.createdAt);
}

export async function remove(id: string): Promise<void> {
  await idbDelete(STORE, id);
}

export async function count(): Promise<number> {
  const ops = await idbGetAll<QueuedOperation>(STORE);
  return ops.length;
}

export async function clear(): Promise<void> {
  await idbClear(STORE);
}

let isReplaying = false;

export async function replayQueue(): Promise<void> {
  // Prevent concurrent replays
  if (isReplaying) return;
  isReplaying = true;

  try {
    const supabase = createClient();
    const ops = await dequeueAll();

    // Ops are ordered by createdAt and can be causally dependent (e.g. add then
    // update the same product). On a transient failure we STOP rather than skip
    // ahead — running a later op after an earlier one failed would apply changes
    // out of order (an update against a row the failed add never created just
    // silently affects 0 rows and the change is lost). Only a permanently
    // failing op (max retries hit) is dropped so it can't block the queue.
    for (const op of ops) {
      try {
        await executeOperation(supabase, op);
        await remove(op.id);
      } catch {
        op.retryCount++;
        if (op.retryCount >= op.maxRetries) {
          await remove(op.id);
          continue; // give up on this op, keep replaying the rest
        }
        await idbPut(STORE, op);
        break; // preserve ordering — retry this and the remaining ops later
      }
    }
  } finally {
    isReplaying = false;
  }
}

async function executeOperation(
  supabase: ReturnType<typeof createClient>,
  op: QueuedOperation,
): Promise<void> {
  const { type, payload } = op;
  const userId = payload.userId as string;
  const productId = payload.productId as string;

  switch (type) {
    case "cart-add": {
      const quantity = payload.quantity as number;
      const { error } = await supabase
        .from("cart_items")
        .upsert(
          {
            user_id: userId,
            product_id: productId,
            quantity,
            rental_start: (payload.rentalStart as string | undefined) ?? null,
            rental_end: (payload.rentalEnd as string | undefined) ?? null,
          },
          { onConflict: "user_id,product_id" },
        );
      if (error) throw error;
      break;
    }
    case "cart-update": {
      const quantity = payload.quantity as number;
      const { error } = await supabase
        .from("cart_items")
        .update({ quantity })
        .eq("user_id", userId)
        .eq("product_id", productId);
      if (error) throw error;
      break;
    }
    case "cart-remove": {
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("user_id", userId)
        .eq("product_id", productId);
      if (error) throw error;
      break;
    }
    case "cart-clear": {
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("user_id", userId);
      if (error) throw error;
      break;
    }
    case "wishlist-add": {
      const { error } = await supabase
        .from("wishlist_items")
        .upsert(
          { user_id: userId, product_id: productId },
          { onConflict: "user_id,product_id" },
        );
      if (error) throw error;
      break;
    }
    case "wishlist-remove": {
      const { error } = await supabase
        .from("wishlist_items")
        .delete()
        .eq("user_id", userId)
        .eq("product_id", productId);
      if (error) throw error;
      break;
    }
  }
}
