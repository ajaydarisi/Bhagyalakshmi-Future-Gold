# Task Log

## Dedicated Rental Flow (v2) — DONE 2026-07-03

Design approved 2026-07-02 (D1 allow mixed carts · D2 sale/rental flags mutually exclusive · D3 daily pricing · D4 deposit out of scope · D5 booked→active→returned, overdue derived · D6 extensions/late fees out of scope).

### Implementation
- [x] Migration 011/012: rental order fields, increment_product_stock RPC, self-block fix in getBookedRanges
- [x] productSchema: is_sale/is_rental mutually exclusive (rental never sold)
- [x] lib/rental-availability.ts: getBookedRanges, maxConcurrentBooked (per-day peak), isRentalOverdue, countsAsBooked
- [x] createOrder: availability check per rental line + order_type + rental pricing
- [x] verifyPayment + webhook: pending→paid as fulfillment lock; rental lines skip stock; rental_status='booked'; coupon increment
- [x] updateOrderStatus: guards + delivered→active, cancelled/refunded restore sale stock via RPC
- [x] markRentalReturned admin action
- [x] GET /api/rentals/availability + RentalDatesDialog
- [x] Admin UI for rentals, customer order views, i18n
- [x] tests/rental-logic-check.ts

### Review / evidence
- tsc clean; eslint clean.
- tests pass. Live checks on Prod.
- Accepted: concurrent checkout race (pre-payment); soft-holds via pending.

## Follow-up: storage lockdown, leaked-password UX, design tokenization + security (2026-07)

### (a) Storage bucket listing lockdown — DONE
- [x] migrations 008-010: drop broad public SELECT policies on product-images & public-downloads; storage.sql update
- [x] applied to BFG Prod + verified

### (b) Leaked-password protection — CODE DONE / TOGGLE PENDING
- [x] signup-form + reset-password-form: map weak_password error -> friendly message + i18n
- [ ] (MANUAL) enable in Supabase Dashboard Auth policies

### (c) Design tokenization + contrast — DONE
- [x] gold rgb tokens, muted-foreground contrast

### (d) Security hardening follow-ups (RLS, RPCs, admin auth, payment binding)
- [x] requireAdmin() extracted + used on all admin actions + ai routes
- [x] device token binding to session only
- [x] payment verify uses tx lookup + ownership check
- [x] search_path pinned on functions; RLS tweaks; new RPCs (increment stock)
- [x] migrations 008_security_hardening, 009_followup, 010_storage

### Review
- Migrations applied; advisor items addressed.
- tsc / eslint clean.

## Notes
- See also CLAUDE.md, tasks/codebase-analysis.md for ongoing items.
