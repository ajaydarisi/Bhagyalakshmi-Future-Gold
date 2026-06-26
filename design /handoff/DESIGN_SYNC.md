# DESIGN_SYNC.md

> Instruction file for **Claude Code `/design-sync`**. Read this top-to-bottom before editing.
> It describes how to apply the BFG redesign to **this existing repo** (Next.js App Router · Supabase · Razorpay · Capacitor). It is a **visual + UX sync**, not a rewrite.

## 0. Source of truth
This handoff folder contains:
- `tokens.json` / `tokens.css` — design tokens (colors, type, spacing, radii, shadows, motion).
- `component-specs.md` — per-component & per-screen layout, props, variants, states, breakpoints, with target file paths.
- `INTEGRATION_GUIDE.md` — the exact ordered sequence to run + verify.
- (Reference) the live prototypes in the design system under `ui_kits/{storefront,auth,account,admin}` — read them for exact visual structure when a spec is ambiguous.

## 1. Golden rules (do NOT violate)
1. **Never change data, business logic, or security.** Do not touch Supabase schema/RLS, server actions' logic, Razorpay verify/webhook, auth, middleware, or Zod **rules** (you may align messages/labels to the design, not the constraints).
2. **Presentation layer only.** Edit components, styles, layout, className, copy, and *new presentational* subcomponents. Keep all hooks, queries, props, and data flow intact.
3. **Preserve `IS_ONLINE` / store-mode gating** everywhere it exists (`lib/constants.ts`). The design has online + offline variants — wire to the existing flag, don't hardcode.
4. **Preserve i18n.** Use `useTranslations` / `messages/*`. If the design introduces new copy, add keys to **all** namespaces (en + te). Never inline user-facing English.
5. **Keep routes, URLs, params, SEO/metadata, loading/error/empty states.** The prototype is a SPA; do not collapse real routes into client state.
6. **Accessibility forward, not backward** — adopt the spec's a11y notes (real radios, labels, focus rings); never regress existing semantics.
7. Match existing conventions: `@/` alias, kebab-case files, PascalCase components, RHF+Zod, `cn()`, shadcn/ui primitives, Tailwind v4.

## 2. Order of operations (high-level — details in INTEGRATION_GUIDE.md)
1. **Tokens** → 2. **Primitives** (button/input/badge/etc.) → 3. **Layout** (header/footer/nav) → 4. **Storefront screens** → 5. **Auth** → 6. **Account** → 7. **Admin** → 8. **New features** (feedback already exists; wire AI assistant UI) → 9. **A11y + responsive pass** → 10. **Verify**.
Do one layer at a time; typecheck + visually verify before the next.

## 3. What to update, where, how

### 3.1 Tokens (do first)
- Merge `tokens.css` `:root` into `src/app/globals.css` (or `@import`). Add the `@theme inline` block next to your `@import "tailwindcss";` so utilities resolve.
- Load fonts: prefer `next/font` (Cormorant Garamond, Marcellus, Hanken Grotesk, Noto Sans Telugu) exposing `--font-display/-brand/-body/-telugu`; otherwise keep the Google `@import`.
- Port the motion layer (keyframes + `.bfg-*` utilities) from `tokens/effects.css` into `globals.css`.
- Verify nothing else references removed/renamed variables.

### 3.2 Component map (prototype → repo target)
| Area | Prototype | Repo target |
|---|---|---|
| Button/Input/Badge/IconButton | DS components | `src/components/ui/*` (extend shadcn variants) |
| Price/Qty/SectionHeading/Logo | DS components | `src/components/shared/*` |
| Header/Footer/MobileNav/BottomNav | `storefront/Header.jsx`, `Footer.jsx` | `src/components/layout/*` |
| Home | `storefront/HomeScreen.jsx` | `src/app/[locale]/(store)/page.tsx` + `components/home/*` |
| Listing/filters/sort/card | `storefront/ListingScreen.jsx` | `src/app/[locale]/(store)/products/page.tsx` + `components/products/*` |
| Product detail | `storefront/DetailScreen.jsx` | `(store)/products/[slug]/page.tsx` + `components/products/product-detail.tsx` |
| Cart + sheet | `storefront/CartScreen.jsx` | `(store)/cart/page.tsx` + `components/cart/*` |
| Checkout (3-step) | `storefront/CheckoutScreen.jsx` | `(store)/checkout/page.tsx` + `components/checkout/*` |
| Search / Wishlist / Legal / About | `storefront/Extras.jsx` | matching `(store)/*` routes |
| Feedback | `storefront/FeedbackScreen.jsx` | `(store)/feedback/page.tsx` |
| AI assistant | `storefront/Assistant.jsx` | `components/shared/assistant.tsx` (+ `app/api/ai/*`) |
| Auth (login/signup/forgot/reset) | `auth/Auth.jsx` | `src/app/[locale]/(auth)/**` + `components/auth/*` |
| Account (overview/profile/orders/addresses/wishlist) | `account/Account.jsx` | `(store)/account/**` |
| Admin shell/dashboard/products/orders/categories/coupons/users/notifications | `admin/*.jsx` | `src/app/admin/**` + `components/admin/*` |

For each target: apply the spec's **layout, variants, states, breakpoints**; keep the file's existing props/data hooks. Re-skin, don't re-architect.

### 3.3 Per-area must-dos (deltas the design adds)
- **Header:** category nav links must carry `?category=`; cart hidden when `!IS_ONLINE`.
- **Listing:** keep server filter/sort/pagination + URL state; add out-of-stock overlay; keep sale/rental + category-hierarchy filters.
- **Detail:** multi-image carousel; real stock; rental deposit/max-days; "Buy now" → `/checkout`.
- **Cart:** add slide-over sheet; coupon via existing coupon validation.
- **Checkout:** 3-step (address/review/payment) with progress; keep Razorpay `PaymentButton`, login-gate, empty-cart redirect, confirmation route.
- **Auth:** add Google button to login *and* signup; keep Supabase calls.
- **Account:** add **Profile** (edit + change password) and **Delete account** danger zone; addresses add/edit/delete; offline hides orders/addresses.
- **Admin:** off-canvas sidebar ≤860px (logo + "Admin" only); interactive order-status; product/category/coupon create-edit forms; user role select; image upload → Supabase Storage.
- **Assistant:** keep UI; back it with Gemini + catalog retrieval.

## 4. Guardrails / red flags — stop and ask if you find yourself about to:
- edit `supabase/`, `*/actions.ts` logic, `lib/razorpay/*`, `middleware.ts`, `lib/supabase/*`, or any Zod constraint;
- remove a route, loading/error file, or metadata export;
- replace a server component's data fetch with client state;
- inline English strings or drop a translation key.

## 5. Definition of done (per screen)
Visual matches spec ✓ · all existing props/data intact ✓ · `IS_ONLINE` + i18n honored ✓ · responsive at the spec breakpoints ✓ · `tsc --noEmit` + `next lint` clean ✓ · existing tests pass ✓.
