// Rental flow logic check — run with: npx tsx tests/rental-logic-check.ts
// Covers the pure business logic behind the rental flow: pricing per
// duration, availability peak counting, and derived overdue.
import assert from "node:assert";
import {
  getRentalDays,
  getCartLineUnitPrice,
  isRentalOnlyProduct,
} from "../src/lib/product-pricing";
import {
  maxConcurrentBooked,
  isRentalOverdue,
  countsAsBooked,
  PENDING_HOLD_MINUTES,
  type BookedRange,
} from "../src/lib/rental-availability";
import { getRentalDateConstraints } from "../src/lib/offline-store-ui";
import { format } from "date-fns";

// --- Pricing per duration -------------------------------------------------
const rental = {
  price: 20000,
  discount_price: null,
  is_sale: false,
  is_rental: true,
  rental_price: 4299,
  rental_discount_price: 2999,
};
const sale = {
  price: 1000,
  discount_price: 799,
  is_sale: true,
  is_rental: false,
  rental_price: null,
  rental_discount_price: null,
};

assert.equal(getRentalDays("2026-07-10", "2026-07-12"), 3, "inclusive days");
assert.equal(getRentalDays("2026-07-10", "2026-07-10"), 1, "same day = 1 day");
assert.equal(
  getCartLineUnitPrice(rental, "2026-07-10", "2026-07-12"),
  2999 * 3,
  "rental discount price × days"
);
assert.equal(
  getCartLineUnitPrice({ ...rental, rental_discount_price: null }, "2026-07-10", "2026-07-12"),
  4299 * 3,
  "rental base price × days"
);
assert.equal(getCartLineUnitPrice(sale), 799, "sale unchanged: discount price");
assert.equal(
  getCartLineUnitPrice({ ...sale, discount_price: null }),
  1000,
  "sale unchanged: base price"
);
// Rental product never priced from the sale fields
assert.notEqual(
  getCartLineUnitPrice(rental, "2026-07-10", "2026-07-12"),
  rental.price,
  "rental line must not use sale price"
);
assert.equal(isRentalOnlyProduct(rental), true);
assert.equal(isRentalOnlyProduct(sale), false);

// --- Availability (double-booking) -----------------------------------------
const booked: BookedRange[] = [
  { rental_start: "2026-07-10", rental_end: "2026-07-12", quantity: 1 },
  { rental_start: "2026-07-15", rental_end: "2026-07-16", quantity: 1 },
];

// Overlapping request on a stock-1 product is blocked (peak 1 + qty 1 > 1)
assert.equal(maxConcurrentBooked(booked, "2026-07-12", "2026-07-14"), 1, "overlap detected");
// Non-overlapping adjacent request is allowed (peak 0)
assert.equal(maxConcurrentBooked(booked, "2026-07-13", "2026-07-14"), 0, "gap is free");
// Back-to-back bookings inside the window don't double count (peak, not sum)
assert.equal(
  maxConcurrentBooked(booked, "2026-07-10", "2026-07-16"),
  1,
  "peak concurrency, not sum over window"
);
// Two units booked the same day
assert.equal(
  maxConcurrentBooked(
    [...booked, { rental_start: "2026-07-11", rental_end: "2026-07-11", quantity: 1 }],
    "2026-07-11",
    "2026-07-11"
  ),
  2,
  "same-day bookings stack"
);

// --- Soft-hold counting (own pending order must not self-block) -------------
const now = Date.now();
const fresh = new Date(now - 60_000).toISOString(); // 1 min ago, inside window
const stale = new Date(now - (PENDING_HOLD_MINUTES + 1) * 60_000).toISOString();

assert.equal(
  countsAsBooked({ status: "paid", created_at: stale, user_id: "u1" }, now, "u1"),
  true,
  "confirmed orders always count, even for the caller"
);
assert.equal(
  countsAsBooked({ status: "pending", created_at: fresh, user_id: "u2" }, now, "u1"),
  true,
  "another buyer's fresh pending order holds inventory"
);
assert.equal(
  countsAsBooked({ status: "pending", created_at: fresh, user_id: "u1" }, now, "u1"),
  false,
  "caller's own pending order is excluded so a retry isn't self-blocked"
);
assert.equal(
  countsAsBooked({ status: "pending", created_at: stale, user_id: "u2" }, now, "u1"),
  false,
  "an abandoned pending hold lapses after the window"
);

// --- Derived overdue --------------------------------------------------------
assert.equal(isRentalOverdue("active", "2026-07-01", "2026-07-03"), true, "active past due");
assert.equal(isRentalOverdue("active", "2026-07-05", "2026-07-03"), false, "active not yet due");
assert.equal(isRentalOverdue("returned", "2026-07-01", "2026-07-03"), false, "returned never overdue");
assert.equal(isRentalOverdue("booked", "2026-07-01", "2026-07-03"), false, "booked never overdue");
assert.equal(isRentalOverdue("active", null, "2026-07-03"), false, "no end date, no overdue");

// --- Picker bound matches the checkout limit (no off-by-one) ----------------
// The rental dialog's last selectable end date must yield exactly max_rental_days
// inclusive days, otherwise the calendar offers a period checkout then rejects.
for (const maxDays of [1, 3, 5, 30]) {
  const start = new Date("2026-07-10T00:00:00");
  const { endDateMax } = getRentalDateConstraints({
    startDate: start,
    maxRentalDays: maxDays,
  });
  assert.ok(endDateMax, "endDateMax present when start + maxRentalDays set");
  assert.equal(
    getRentalDays(format(start, "yyyy-MM-dd"), format(endDateMax!, "yyyy-MM-dd")),
    maxDays,
    `picker's last end date yields exactly ${maxDays} inclusive day(s)`
  );
}

console.log("all rental logic assertions passed");
