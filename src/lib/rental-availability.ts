import type { createAdminClient } from "@/lib/supabase/admin";

// Order statuses that hold rental inventory. Cancelled/refunded orders release
// their dates. Pending (unpaid) orders act as SOFT holds for a short window
// (see PENDING_HOLD_MINUTES) so a second buyer mid-checkout sees the first
// buyer's in-flight reservation and is rejected before paying; abandoned
// pending orders stop counting once the window lapses.
const BOOKING_STATUSES = ["paid", "processing", "shipped", "delivered"];

// How long an unpaid order holds rental dates. Long enough to finish paying,
// short enough that an abandoned checkout frees the dates quickly.
export const PENDING_HOLD_MINUTES = 15;

export interface BookedRange {
  rental_start: string;
  rental_end: string;
  quantity: number;
}

interface RawBookedRow {
  rental_start: string | null;
  rental_end: string | null;
  quantity: number;
  orders: { status: string; created_at: string; user_id: string | null };
}

/**
 * Booked rental periods for a product. Includes confirmed orders plus recent
 * unpaid orders as soft holds (see PENDING_HOLD_MINUTES). Reads order_items, so
 * it needs the admin client (no public read policy). `fromDate` (ISO
 * yyyy-MM-dd) trims ranges that ended before it.
 *
 * Note: this narrows but does not fully eliminate double-booking. Two checkouts
 * that read availability in the same instant (before either inserts its pending
 * order) can still both pass; closing that requires DB-level serialization
 * (advisory lock / reservation row inside a single transaction).
 *
 * `excludePendingUserId` drops that user's OWN pending orders from the soft
 * holds — a buyer who dismisses the Razorpay modal and retries (each Pay Now
 * mints a new pending order) must not be blocked by their own in-flight
 * reservation on a single-capacity rental. Confirmed orders are never dropped.
 */
export async function getBookedRanges(
  admin: ReturnType<typeof createAdminClient>,
  productId: string,
  fromDate?: string,
  excludePendingUserId?: string
): Promise<BookedRange[]> {
  let query = admin
    .from("order_items")
    .select(
      "rental_start, rental_end, quantity, orders!inner(status, created_at, user_id)"
    )
    .eq("product_id", productId)
    .eq("is_rental", true)
    .in("orders.status", [...BOOKING_STATUSES, "pending"]);
  if (fromDate) {
    query = query.gte("rental_end", fromDate);
  }

  const { data, error } = await query;
  if (error) throw error;

  const now = Date.now();

  return ((data ?? []) as unknown as RawBookedRow[])
    .filter((r) => r.rental_start && r.rental_end)
    .filter((r) => countsAsBooked(r.orders, now, excludePendingUserId))
    .map((r) => ({
      rental_start: r.rental_start as string,
      rental_end: r.rental_end as string,
      quantity: r.quantity,
    }));
}

/**
 * Whether a booked order_items row counts toward availability. Confirmed
 * orders always count; a pending order is a soft hold that counts only while
 * inside PENDING_HOLD_MINUTES and only if it isn't the caller's own in-flight
 * order (excludePendingUserId). Pure, so the checkout branch is testable.
 */
export function countsAsBooked(
  order: { status: string; created_at: string; user_id: string | null },
  now: number,
  excludePendingUserId?: string
): boolean {
  if (order.status !== "pending") return true;
  if (excludePendingUserId && order.user_id === excludePendingUserId) return false;
  return new Date(order.created_at).getTime() > now - PENDING_HOLD_MINUTES * 60_000;
}

/**
 * Overdue is derived, never stored: the rental is with the customer
 * (active) and the latest agreed return date has passed.
 */
export function isRentalOverdue(
  rentalStatus: string | null,
  latestRentalEnd: string | null | undefined,
  today: string = new Date().toISOString().slice(0, 10)
): boolean {
  return rentalStatus === "active" && !!latestRentalEnd && latestRentalEnd < today;
}

/**
 * Peak number of units simultaneously booked on any single day of
 * [start, end] (ISO yyyy-MM-dd, inclusive). Per-day peak — not the sum over
 * the window — so back-to-back bookings within the window don't double-count.
 */
export function maxConcurrentBooked(
  ranges: BookedRange[],
  start: string,
  end: string
): number {
  let peak = 0;
  const cursor = new Date(start);
  const last = new Date(end);
  while (cursor <= last) {
    const day = cursor.toISOString().slice(0, 10);
    const booked = ranges.reduce(
      (sum, r) =>
        r.rental_start <= day && r.rental_end >= day ? sum + r.quantity : sum,
      0
    );
    peak = Math.max(peak, booked);
    cursor.setDate(cursor.getDate() + 1);
  }
  return peak;
}
