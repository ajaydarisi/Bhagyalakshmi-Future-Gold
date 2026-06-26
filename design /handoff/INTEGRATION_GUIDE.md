# INTEGRATION_GUIDE.md — step-by-step

Exact sequence to apply the BFG redesign to your Next.js / Supabase / Razorpay / Capacitor repo. Do steps in order; **verify each before moving on**. Commit per step.

## Prep
```bash
git checkout -b design/bfg-redesign
cp -r <this-handoff-folder> ./design/handoff   # tokens.json, tokens.css, *.md
```
Point Claude Code at it:
```
/design-sync ./design/handoff/DESIGN_SYNC.md
```
Baseline check (must be green before you start):
```bash
npm run lint && npx tsc --noEmit && npm run build
```

---

## Step 1 — Tokens & fonts
**Do:** merge `tokens.css` `:root` into `src/app/globals.css`; add the `@theme inline` block by `@import "tailwindcss";`; load the 4 fonts via `next/font` (or keep the Google `@import`); port the motion keyframes + `.bfg-*` utilities from the prototype's effects layer.
**Run:** `npx tsc --noEmit && npm run dev`
**Verify:** app boots; a test `bg-gold-500` / `text-secondary` / `rounded-lg` resolves; fonts load (display serif on headings, Hanken on body); no missing-variable console warnings.
**Commit:** `design: tokens + fonts + motion layer`

## Step 2 — UI primitives
**Do:** extend `src/components/ui/button.tsx` (variants gold/outline/ghost/dark/maroon; sizes sm/md/lg; loading/block; states) and `input.tsx` (label/hint/error/icon/adornment). Add/skin `badge`, `icon-button`, and shared `price-display`, `quantity-stepper`, `section-heading`, `logo`.
**Run:** `npx tsc --noEmit`; render them on a scratch page or Storybook.
**Verify:** every variant/size/state matches `component-specs.md §1`; focus ring + disabled + loading correct; existing usages still compile.
**Commit:** `design: ui primitives`

## Step 3 — Layout (header / footer / nav)
**Do:** re-skin `components/layout/{header,footer,mobile-nav,bottom-nav}.tsx`. Wire category links to `?category=`; gate cart on `IS_ONLINE`; keep `useTranslations`, `useCart`, `useWishlist`, `useAuth`.
**Run:** `npm run dev`
**Verify:** sticky header, announcement bar (online vs offline copy), drawer + bottom nav ≤760px, badges reflect live cart/wishlist, lang switch works. Toggle `NEXT_PUBLIC_STORE_MODE=OFFLINE` → cart/checkout entry points disappear.
**Commit:** `design: layout + nav`

## Step 4 — Storefront screens (in this sub-order)
1. **Home** → verify all sections + online/offline variants.
2. **Listing** → keep server filtering/sort/**pagination + URL query**; add OOS overlay, sale/rental + hierarchy filters, mobile filter sheet.
3. **Product detail** → multi-image carousel, real stock, rental deposit/max-days, Buy-now→checkout, related; offline WhatsApp CTA.
4. **Cart** → line items + summary + free-ship progress; add **cart sheet**; coupon via existing validation.
5. **Search / Wishlist / About / Legal** → skin; keep `?q=` server search, auth-gated wishlist.
**Run after each:** `npx tsc --noEmit`; click the full journey home→listing→detail→cart.
**Verify:** data unchanged, only presentation; responsive at breakpoints; i18n intact.
**Commit:** one per screen (`design: storefront/home`, …).

## Step 5 — Checkout (most sensitive — do carefully)
**Do:** rebuild 3-step UI (Address → Review → Payment) + progress indicator + sticky summary. **Keep** the existing `PaymentButton` (Razorpay order create → checkout → verify), login-gate redirect, empty-cart redirect, and confirmation route keyed by `order_id`. Address form uses existing `addressSchema`.
**Run:** `npm run dev`; in Razorpay **test mode**, place a full order.
**Verify:** payment success → confirmation with real order id; failure path still handled; webhook still updates status/stock/clears cart; coupon discount correct.
**Commit:** `design: checkout (razorpay flow intact)`

## Step 6 — Auth
**Do:** skin login/signup/forgot/reset (split-screen); add Google button to login + signup; inline validation via existing schemas; success/confirmation panels. Keep Supabase Auth calls + redirect param.
**Run:** sign up, log in, forgot/reset, Google — in a Supabase test project.
**Verify:** sessions/cookies set as before; protected routes still redirect; validation messages match.
**Commit:** `design: auth`

## Step 7 — Account
**Do:** sidebar nav incl. new **Profile** (edit + change password) and **Delete account** danger zone (typed-DELETE → existing delete action); orders list + detail; addresses add/edit/delete; offline hides orders/addresses.
**Run:** edit profile, change password, CRUD an address, open an order.
**Verify:** all writes go through existing actions/RLS; counts derive from real data; offline gating correct.
**Commit:** `design: account`

## Step 8 — Admin
**Do:** ink shell + **off-canvas sidebar ≤860px** (logo + "Admin"); dashboard (Recharts); products table + **create/edit drawer** (bilingual, rental, status) with **Supabase Storage image upload**; orders + **interactive status pipeline**; categories/coupons create-edit modals; users role select; notifications composer/history. All behind `isAdmin` + RLS.
**Run:** create/edit a product (with image), advance an order status, create a coupon, change a role.
**Verify:** every mutation uses existing admin server actions; role-gating enforced; mobile nav reachable.
**Commit:** `design: admin`

## Step 9 — AI assistant + polish
**Do:** add `components/shared/assistant.tsx` (floating launcher + chat + recommendation cards); back it with your `app/api/ai/*` (Gemini + catalog retrieval). Then the a11y/responsive pass from `component-specs.md §6–7`.
**Run:** ask the assistant for a category/budget; tab through forms.
**Verify:** recommendations link to real products; keyboard + screen-reader OK; reduced-motion respected.
**Commit:** `design: assistant + a11y`

## Step 10 — Full verification & native
```bash
npm run lint && npx tsc --noEmit && npm run build && npm test
npx playwright test          # your e2e specs (home, products, auth, wishlist, admin, assistant…)
npx cap sync && npx cap run android   # confirm app shell, safe-areas, bottom nav, push still work
```
**Verify matrix:** ONLINE + OFFLINE store modes · en + te locales · light (and dark, once themed) · mobile/tablet/desktop · guest + logged-in + admin. Lighthouse for a11y/perf regressions.
**Merge:** open PR `design/bfg-redesign`; review against `component-specs.md` Definition-of-Done per screen.

---

### Rollback
Each step is its own commit — `git revert <sha>` to undo a layer without losing the rest. Tokens (Step 1) are additive; reverting it last is safe.

### If something's ambiguous
Open the matching prototype in `ui_kits/<kit>/` and read the component — it's the exact visual reference. Backend questions are out of scope for design-sync: keep the existing implementation.
