# Dedicated Rental Flow (v2) — DONE 2026-07-03

Design approved 2026-07-02 (D1 allow mixed carts · D2 sale/rental flags mutually exclusive · D3 daily pricing · D4 deposit out of scope · D5 booked→active→returned, overdue derived · D6 extensions/late fees out of scope).

## Implementation
- [x] Migration 010: orders.order_type + orders.rental_status + rental period index + backfill (applied to BFG Prod)
- [x] productSchema: is_sale/is_rental mutually exclusive (rental never sold)
- [x] lib/rental-availability.ts: getBookedRanges, maxConcurrentBooked (per-day peak), isRentalOverdue
- [x] createOrder: availability check per rental line + order_type
- [x] verifyPayment + webhook: pending→paid transition as fulfillment lock (fixes pre-existing double-decrement race); rental lines skip stock decrement; rental_status='booked'
- [x] updateOrderStatus: delivered auto-sets rental_status='active'; new markRentalReturned action
- [x] GET /api/rentals/availability: booked ranges + capacity (public, ranges only)
- [x] RentalDatesDialog: fetches availability, disables booked dates, blocks ranges spanning a booked day
- [x] Admin: orders type filter (All/Sale/Rental), RentalStatusBadge w/ derived Overdue, Mark Returned button on order detail
- [x] Customer order detail: rental status line + return-by
- [x] i18n: rentalUnavailable + rentalStatuses (en + te)
- [x] tests/rental-logic-check.ts (npx tsx) — pricing, overlap peak, overdue

## Review / evidence
- tsc clean; eslint clean on all changed files.
- tests/rental-logic-check.ts: all assertions pass.
- Live verification against BFG Prod (temp order TEST-RENTAL-CHECK, deleted after):
  - availability API returned the booked range for a paid rental order;
  - cancelling the order released the dates (empty ranges);
  - dialog calendar disabled exactly the booked 20–22 Jul days, adjacent days enabled;
  - 400 on invalid productId.
- Known accepted gap (flagged in design): concurrent-checkout race between availability check and payment capture; upgrade path = re-check at capture + admin alert.
- Out of scope per design: deposits online, extensions, late fees, customer-initiated cancellation.
