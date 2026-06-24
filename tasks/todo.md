# Follow-up: storage lockdown, leaked-password UX, design tokenization

## (a) Storage bucket listing lockdown — DONE
- [x] migration 010: drop broad public SELECT policies on product-images & public-downloads
- [x] applied to BFG Prod + verified (0 listing policies, 2 public buckets, advisor warnings cleared)
- [x] update canonical storage.sql

## (b) Leaked-password protection — CODE DONE / TOGGLE PENDING
- [x] signup-form: map weak_password error -> friendly localized message
- [x] reset-password-form: same
- [x] add i18n keys (en/te)
- [ ] (MANUAL, user) enable Dashboard toggle: Auth -> Policies -> "Leaked password protection"
- note: in-app change-password uses admin updateUserById (service role) which
  bypasses HIBP by design (it verifies the current password first); signup +
  reset (user-session updateUser) are the covered paths.

## (c) Design tokenization + contrast — DONE
- [x] --gold-rgb / --gold-deep-rgb tokens; hardcoded gold replaced in wedding-hero(+pattern), zero visual change
- [x] light muted-foreground 0.50 -> 0.44 for WCAG AA on small secondary text

## Review
- Migrations 008, 009 (DB-only), 010 applied to BFG Prod; all advisor ERROR-level
  and function/storage findings resolved.
- Remaining advisor items (none blocking):
  - leaked-password protection: needs the manual Dashboard toggle (code ready).
  - extension `vector` in public schema: invasive to move; left as-is.
  - order_status_history INSERT `WITH CHECK (true)`: minor, candidate for a future tighten.
  - rls_enabled_no_policy (coupons/feedback/notifications/catalog_retrieval_documents/health): intentional (service-role-only tables).
- Code deployed to prod via main (Vercel).
- Verification: tsc clean, eslint clean, auth JSON valid.
</content>
