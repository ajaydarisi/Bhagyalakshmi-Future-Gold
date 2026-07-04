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
  type BookedRange,
} from "../src/lib/rental-availability";

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

// --- Derived overdue --------------------------------------------------------
assert.equal(isRentalOverdue("active", "2026-07-01", "2026-07-03"), true, "active past due");
assert.equal(isRentalOverdue("active", "2026-07-05", "2026-07-03"), false, "active not yet due");
assert.equal(isRentalOverdue("returned", "2026-07-01", "2026-07-03"), false, "returned never overdue");
assert.equal(isRentalOverdue("booked", "2026-07-01", "2026-07-03"), false, "booked never overdue");
assert.equal(isRentalOverdue("active", null, "2026-07-03"), false, "no end date, no overdue");

console.log("all rental logic assertions passed");
