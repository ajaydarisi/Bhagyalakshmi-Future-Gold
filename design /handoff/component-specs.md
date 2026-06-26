# BFG — Component & Screen Specs

Source: BFG Design System prototypes (`ui_kits/`). Target: Next.js App Router + shadcn/ui + Tailwind v4.
All visual values reference tokens in `tokens.css` / `tokens.json`. **This document is design intent only — it never prescribes backend changes.** Wire to your existing data/queries.

Conventions assumed (from your CLAUDE.md): files `kebab-case`, components `PascalCase`, `@/` alias, RHF + Zod for forms, `cn()` util, mobile-first (`md:` / `lg:`).

---

## 1. Design primitives (map to `src/components/ui/*` shadcn + small custom)

### Button — `src/components/ui/button.tsx`
- **Variants:** `gold` (filled `--grad-gold`, `--shadow-gold`, ink text), `outline` (gold hairline `--border-gold`, transparent), `ghost` (text only), `dark` (`--ink-900` bg, ivory text), `maroon` (`--maroon-500`).
- **Sizes:** `sm` 36px / `md` 44px (default) / `lg` 52px (`--control-*`). Pill radius (`--radius-pill`).
- **Props:** `variant, size, iconLeft, iconRight, loading, block, disabled, asChild`.
- **States:** hover = slight lift / deepen gold; active = `scale(var(--press-scale))`; focus-visible = `--ring-focus`; loading = spinner, label hidden; disabled = 0.5 opacity, no pointer.
- **Label:** uppercase, wide tracking (`--ls-wide`); keep short.

### Input / Field — `src/components/ui/input.tsx` (+ RHF wrappers)
- Cream surface (`--surface-card`), `--border-strong` 1px, `--radius-md`, height `--control-md`/`lg`.
- **Props:** `label, hint, error, iconLeft, adornment, size, required` + native.
- **States:** focus = `--gold-500` border + `--ring-focus`; error = `--error` border, error text replaces hint; required shows maroon `*`.

### Badge — tones: `gold, maroon, new, rental, sale, neutral, success, info, warning`. Pill, `--text-2xs`, uppercase. Optional `dot`.
### IconButton — square/round ghost or soft; optional numeric `badge` bubble (maroon). 44px touch target.
### PriceDisplay — current price `--type-price`; struck MRP `--text-muted line-through`; discount % `Badge tone=sale`; rental shows "/day".
### QuantityStepper — −/＋ with value, `min`/`max` (cap 10 default), `sm` size for cart lines.
### SectionHeading — optional eyebrow (`--type-eyebrow` + `.bfg-ornament`), title (`--type-h2/h3`), subtitle; `align`, `ornament` props.
### Logo — `layout` horizontal/stacked, `size`, `onDark`, `imageSrc`.

> **Motion layer** (port to `globals.css`): keyframes `bfg-fade-up/-rise/-fade-in/-shimmer/-float/-skeleton/-twinkle/-spin/-heart-pop` + `.bfg-foil`, `.bfg-gold-shimmer`, `.bfg-ornament`, and the `.bfg-animate*`/`.bfg-stagger` reveal utilities (gated on `prefers-reduced-motion`). Source: `tokens/effects.css`.

---

## 2. Storefront screens → `src/app/[locale]/(store)/**` + `src/components/**`

### Header / nav — `src/components/layout/header.tsx`, `mobile-nav.tsx`, `bottom-nav.tsx`
- Sticky. Announcement bar (ink bg, gold text) → online: shipping msg; offline: store-visit msg.
- Desktop: logo · category nav · lang toggle · search · wishlist(badge) · account · cart(badge, **online only**).
- Mobile: hamburger → drawer; logo; search pill; bottom tab bar (Home/Shop/Saved/Bag‖Store/Account).
- **Category nav must filter** — link to `/products?category=<slug>` (prototype passes a category that pre-seeds the listing filter).
- **`IS_ONLINE` gating:** cart icon, bottom Bag tab hidden when offline (use your `lib/constants.ts`).
- Breakpoints: desktop ≥1100; app shell ≤760.

### Home — `src/app/[locale]/(store)/page.tsx`
Sections in order: Hero (copy + bridal image, foil headline, stat row, CTAs) → Category strip → Featured grid (4) → Story band (3-image collage + promises) → Trust bar (online vs offline items) → Visit/Newsletter band. Offline: show **wishlist CTA** band (per existing app) instead of newsletter.

### Listing — `src/app/[locale]/(store)/products/page.tsx` + `components/products/*`
- Layout: 248px filter sidebar + results grid (3-up desktop, 2-up mobile).
- Filters: category (hierarchy), material, price range, **sale/rental type**. Sort: newest/price↑↓/discount/popularity.
- Mobile: filter bottom-sheet + sticky sort. Pagination per existing app (prototype used infinite scroll — keep your pagination + URL query).
- States: skeleton cards while loading, empty state, results count. **Out-of-stock overlay on cards.**

### Product detail — `src/app/[locale]/(store)/products/[slug]/page.tsx` + `components/products/product-detail.tsx`
- Layout: sticky gallery (thumb rail + main, **multi-image carousel**) + info column.
- Info: material/badge/rental badges, title, rating, `PriceDisplay`, description (**bilingual**), qty + Add to cart / Buy now (→ checkout) / wishlist; **real stock state**; rental shows deposit + max days; trust strip; related grid.
- Offline: WhatsApp "Check availability" replaces Add to cart.

### Cart — `src/app/[locale]/(store)/cart/page.tsx` + `components/cart/*`
- Line items (image, material, name, qty stepper, line total, remove) + sticky summary (coupon, subtotal, discount, shipping w/ free-over-₹999 progress, total, checkout CTA, Razorpay trust).
- Add a **slide-over cart sheet** (`cart-sheet.tsx`) for quick view.
- Coupon: shared validator (percentage/fixed, min-order) — wire to your `coupons` table.

### Checkout — `src/app/[locale]/(store)/checkout/page.tsx` + `components/checkout/*`
- 3 steps with progress indicator: **Address** (saved list + add-new validated form) → **Review** (items + coupon) → **Payment** (method select → Razorpay).
- Persistent order summary sidebar. Login-gate (`/login?redirect=/checkout`), empty-cart redirect. Confirmation page keyed by `order_id`.
- Address form fields/validation = `addressSchema` (label, name≥2, phone 10-digit, line1≥5, city/state, postal 6-digit, default).

### Search — `src/app/[locale]/(store)/search/page.tsx`
Search field + suggestion chips + results grid; **server full-text search with `?q=` query param** (prototype is client-only).

### Wishlist — `src/app/[locale]/(store)/wishlist/page.tsx`
Grid of saved items; **auth-gated**; offline → "Enquire on WhatsApp".

### Feedback — `src/app/[locale]/(store)/feedback/page.tsx` + `feedback/actions.ts`
Star rating (1–5, **required**), message (**≥10 chars**), optional name/email → thank-you. Validation = `feedbackSchema`. Footer link.

### AI assistant — `src/components/shared/assistant.tsx` (+ `app/api/ai/*`)
Floating launcher (bottom-right; lift above bottom-nav on mobile) → chat panel: messages, suggestion chips, input. Bot replies include clickable product recommendation cards. Prototype uses rule-based intent matching → **swap for your Gemini + catalog-retrieval** backend; keep the UI/recommendation-card pattern.

### Legal/About — `(store)/about`, `terms-and-conditions`, `privacy-policy` — prose layout, `--container-prose` width, bilingual copy from `messages/`.

---

## 3. Auth screens → `src/app/[locale]/(auth)/**` + `src/components/auth/*`

Split-screen: brand panel (hidden <820px) + form column.
- **Login** — email + password, remember-me, forgot link, **Continue with Google**. Validation: `loginSchema`.
- **Signup** — name, email, phone(optional), password + confirm, Google. Validation: `signupSchema` (password=confirm; min 6).
- **Forgot** — email → "check your email" state. `forgotPasswordSchema`.
- **Reset** — new + confirm → success. `resetPasswordSchema`.
All forms: controlled, inline `error` on fields, success/confirmation panels. Wire submit to Supabase Auth + your server actions.

---

## 4. Account → `src/app/[locale]/(store)/account/**`

Sidebar layout (`account/layout.tsx`); nav: Overview · My orders · Addresses · **Profile** · Wishlist · Sign out.
- **Overview** — stat cards (derive counts from data) + recent orders.
- **Profile** — name + phone (10-digit) edit, email read-only, **change password** (current/new/confirm, match) → save confirmations. Validation: `profileUpdateSchema` + `changePasswordSchema`. **Delete account** danger zone with typed-`DELETE` confirmation.
- **Orders** — list → **order detail** (items, address, payment, status). Line items must sum to total.
- **Addresses** — add/edit/delete validated modal (`addressSchema`), default flag.
- **Offline mode:** hide Orders + Addresses (mirror existing `IS_ONLINE`).

---

## 5. Admin → `src/app/admin/**` + `src/components/admin/*`

Ink sidebar (logo + "Admin" only — no "BFG" wordmark) + topbar; **off-canvas drawer ≤860px** (menu button toggles). Auth/role-gated (`isAdmin` + RLS).
- **Dashboard** — KPI cards, 30-day revenue chart (Recharts), category bars, recent orders.
- **Products** — table (search EN/తె, status tabs, counts) + **create/edit drawer**: bilingual name/description, category, material, price + compare-at, stock, set number, tags, status (Active/Draft, auto "Out of stock" at 0), rental toggle → rental price/deposit/max-days. **Image upload → Supabase Storage** (prototype shows placeholder). Validation: `productSchema`. Delete with confirm.
- **Orders** — list + filters + detail drawer with **interactive status pipeline** (pending→paid→processing→shipped→delivered, Cancel, Reinstate). Wire to order status server action.
- **Categories** — cards + create/edit modal (bilingual name); delete.
- **Coupons** — cards + create/edit modal (`couponSchema`: code≥3 upper, percentage/fixed, value>0, min-order, max-uses, active); delete.
- **Users** — table + inline **role select** (customer/admin).
- **Notifications** — composer (type/target/title/body/image/link, user search) + history table with status pills. Wire to your notifications API + Firebase.

---

## 6. Responsive breakpoints (global)
| Token | Width | Behavior |
|---|---|---|
| App shell | ≤760px | bottom nav, drawer, 2-up product grids, stacked hero (image first), form rows collapse to 1col |
| Tablet | ≤1000–1100px | sidebars stack/static, 3-up→2-up grids, footer 2col |
| Admin drawer | ≤860px | sidebar becomes off-canvas overlay |
| Auth | ≤820px | brand panel hidden, single column |
| Desktop | ≥1100px | full layouts, sticky sidebars |

## 7. Accessibility to honor on rebuild
- Replace prototype's hand-rolled radio rows (checkout address/payment) with real `input[type=radio]` (restyled).
- All bare inputs get labels/`aria-label`. Clickable `<a>` nav → real `<Link>`/`<button>`.
- Maintain 44px min touch targets, focus-visible rings, `prefers-reduced-motion` gating.
