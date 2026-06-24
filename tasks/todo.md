# Security Hardening + Design Fix

## Security
- [x] CRITICAL: profiles role escalation — column-level UPDATE grants (migration + schema.sql)
- [x] HIGH: admin server actions — requireAdmin() guard on every action
- [x] HIGH: payment verification — bind to razorpay_order_id + ownership in verifyPayment
- [x] MEDIUM: AI enhance-image route — admin auth + size cap
- [x] MEDIUM: coupons — drop public read policy, read via admin client
- [x] MEDIUM: register-token — derive userId from session only
- [x] MEDIUM: searchUsers — sanitize PostgREST .or() filter input
- [x] LOW: security headers in next.config.ts

## Design
- [x] Fix invalid `right: 5` CSS in globals.css toaster override

## Review

### What changed
- **`supabase/migrations/008_security_hardening.sql`** (new) + **`schema.sql`**:
  - Revoked table-wide UPDATE on `profiles` from `anon`/`authenticated`; granted
    column-level UPDATE on `full_name, phone, avatar_url, updated_at` only.
    Closes the self-promotion-to-admin hole. Service role unaffected.
  - Dropped public SELECT on `coupons` (codes were enumerable).
  - Dropped open INSERT on `device_tokens` (inserts go via service role).
- **`src/lib/auth/require-admin.ts`** (new): shared in-handler admin guard.
- **`admin/actions.ts`**, **`admin/notifications/actions.ts`**: `requireAdmin()`
  on every exported action; sanitized `searchUsers` PostgREST filter input.
- **`checkout/actions.ts`**: `verifyPayment` now requires auth and resolves the
  order from `payment_transactions.razorpay_order_id` + ownership check before
  marking paid (pending→paid only). Coupon reads moved to the admin client.
- **`api/ai/enhance-image/route.ts`**: admin-only + payload size cap + input validation.
- **`api/notifications/register-token/route.ts`**: userId derived from session, never body.
- **`next.config.ts`**: added security response headers.
- **`globals.css`**: fixed invalid `right: 5` → `right: 1rem`.

### IMPORTANT — deployment step
The DB migration must be run against Supabase for the critical/medium RLS fixes
to take effect: apply `supabase/migrations/008_security_hardening.sql`.
Code changes alone do not close the role-escalation hole.

### Verification
- `npx tsc --noEmit` — clean.
- `npx eslint` on all changed files — clean.

### Not done (await explicit approval — subjective design refactor)
- Gold color tokenization (move hardcoded `#d4a017` into a `--gold` token).
- Primary chroma / contrast (a11y) adjustments.
</content>
