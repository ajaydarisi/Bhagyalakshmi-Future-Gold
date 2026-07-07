# Bhagyalakshmi Future Gold

Bilingual (English/Telugu) jewelry e-commerce platform with dual store modes (online/offline) and native mobile app via Capacitor.

## Git Commit Rules

- Do NOT add "Co-authored-by" or any co-authored statement in commit messages.

- **Web**: Vercel deployment at bfg.darisi.in
- **Mobile**: Android/iOS via Capacitor (com.bhagyalakshmifuturegold.app)

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| UI | React | 19.2.3 |
| Language | TypeScript (strict) | 5.9.3 |
| Styling | Tailwind CSS | 4 |
| Components | shadcn/ui (new-york, RSC) | 3.8.5 |
| Icons | Lucide React | 0.574.0 |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage) | 2.97.0 |
| Server State | TanStack React Query | 5.90.21 |
| Forms | React Hook Form + Zod | 7.71.1 / 4.3.6 |
| i18n | next-intl | 4.8.3 |
| Payments | Razorpay | 2.9.6 |
| Email | Resend | 6.9.2 |
| Push Notifications | Firebase (via Capacitor) | 12.10.0 |
| Mobile | Capacitor | 8.1.0 |
| AI | Google Gemini (@google/genai) | 1.43.0 |
| Translation | DeepL | 1.24.0 |
| Charts | Recharts | 3.7.0 |
| Toasts | Sonner | 2.0.7 |

## Project Structure

```
src/
  app/
    [locale]/              # Localized routes (en, te)
      (store)/             # home, products, products/[slug], search, cart, checkout(+confirmation), wishlist, account(+orders/addresses), about, visit, legal, feedback actions
      (auth)/              # login, signup, forgot-password, reset-password
    admin/                 # Admin panel (not localized, guarded in admin/layout.tsx): dashboard, products, orders, categories, users, coupons, notifications; actions.ts has ALL admin mutations
    api/                   # auth/{callback,google-token}, webhooks/razorpay, notifications/{register-token,send,send-product}, search/{products,answer}, assistant/chat, ai/enhance-image
    auth/google/           # Google Sign-In token relay page (non-localized; Android Intent / iOS scheme / web)
    preview/[slug]/        # OG-meta HTML for WhatsApp/social share links
  components/
    ui/                    # shadcn/ui primitives (button, card, dialog, form, input, etc.)
    layout/                # header, footer, mobile-nav, bottom-nav, admin-sidebar, account-sidebar
    products/              # product-card, product-grid, filters/sort, product-detail-content, mobile-detail-bar, rental-dates-dialog, check-availability-button, notify-stock-button, search components
    cart/                  # cart-provider, cart-sheet, cart-summary, cart-item, add-to-cart-button
    checkout/              # checkout-steps, address-form, coupon-input, payment-button
    wishlist/              # wishlist-provider, wishlist-button
    auth/                  # login-form, signup-form, auth-provider, google-sign-in-button
    assistant/             # storefront-assistant (AI chat widget), assistant-product-card
    shared/                # theme, language-switcher, breadcrumbs, pagination, price-display, offline-banner, capacitor-init, push-token-linker, etc.
    admin/                 # product-form, tables, managers, order-status-updater, notification-composer, revenue-chart, ai-image-compare-dialog
    home/                  # featured-products-section, new-arrivals-section
    brand/                 # logo, section-heading
    feedback/              # feedback-form
    providers/             # query-provider
  hooks/                   # use-auth, use-cart, use-wishlist, use-mobile, use-network, use-debounce, use-prefetch, use-product-search-suggestions
  types/                   # database.ts (Supabase Row types), product.ts, order.ts, cart.ts, user.ts, search.ts
  lib/
    supabase/              # client.ts (RLS), server.ts (cookies), admin.ts (service role), middleware.ts, storage.ts
    razorpay/              # client.ts, verify.ts (HMAC)
    queries/               # products.ts (fetchProducts + PRODUCT_LIST_FIELDS), keys.ts (React Query key factory)
    retrieval/             # RAG: catalog.ts (hybrid vector+FTS search, index sync, health), answer.ts (grounded replies), public-documents.ts (store_info/faq/legal)
    assistant*.ts          # assistant.ts (intent parsing, WhatsApp handoff), assistant-config.ts (caps), assistant-product-recommendations.ts
    ai/                    # enhance-image.ts, gemini.ts
    product-pricing.ts     # SINGLE source of price logic: sale vs rental-only, getCartLineUnitPrice, getRentalDays
    offline-store-ui.ts    # Store-mode + rental branching: sold-out overlay, detail action state, WhatsApp messages, rental date constraints
    constants.ts           # ROUTES, BUSINESS_INFO, IS_ONLINE, SHIPPING_COST/FREE_SHIPPING_THRESHOLD
    validators.ts          # Zod schemas (auth, product, coupon, category, address, feedback)
    formatters.ts          # formatPrice (₹ en-IN), calculateDiscount, dates, slug, order number
    i18n-helpers.ts        # getProductName/Description, getCategoryName (te fallback en)
    operation-queue.ts     # IndexedDB offline mutation queue (cart/wishlist ops, 5 retries, replay on reconnect)
    product-cache.ts       # localStorage product cache (20 items, 30min TTL)
    prefetch.ts            # idle cache warming; image-preloader.ts (SW Cache API)
    notifications.ts       # FCM push: order status + product (price_drop/new/back-in-stock) templates
    push-notifications.ts  # Client FCM init/token registration
    email.ts               # Resend emails
    firebase-admin.ts, haptics.ts, gtag.ts, share.ts, background-task.ts, idb-helpers.ts, utils.ts
  i18n/                    # config.ts, routing.ts, request.ts
  middleware.ts            # i18n routing + Supabase session refresh; skips i18n for /admin, /api, /auth, /preview
messages/
  en/, te/                 # common, home, products, constants, about, auth, account, cart, wishlist, search, legal, feedback, assistant
supabase/                  # schema.sql, migrations/, seed.sql, storage.sql
android/, ios/             # Capacitor native projects
public/                    # Static assets, sw.js (service worker), offline.html
```

## Configuration

- **TypeScript**: strict mode, `@/*` path alias to `./src/*`, target ES2022
- **Next.js**: App Router, Turbopack, `staleTimes: { dynamic: 30, static: 300 }`, `inlineCss: true`, `optimizePackageImports: [lucide-react, recharts, cmdk]`, image remotes for Supabase/Google/Unsplash
- **ESLint**: v9 flat config, extends `next/core-web-vitals` + `next/typescript`
- **PostCSS**: `@tailwindcss/postcss` v4
- **shadcn/ui**: new-york style, RSC enabled, CSS variables, neutral base color, lucide icons

## Database (Supabase PostgreSQL)

All user-scoped tables have RLS enabled.

| Table | Purpose |
|-------|---------|
| profiles | User profile (extends auth.users via trigger), role: customer/admin |
| products | Catalog items, bilingual name/description, price/discount_price, is_sale/is_rental, rental_price/rental_discount_price/rental_deposit/max_rental_days, stock, images[], slug, fts tsvector |
| categories | Hierarchical with bilingual names, slug, parent_id, sort_order |
| cart_items | Persisted cart for logged-in users, unique(user_id, product_id); rental_start/rental_end for rental lines. Guests use localStorage |
| wishlist_items | Favorite products, unique(user_id, product_id) |
| orders | Order records, status enum (pending→paid→processing→shipped→delivered / cancelled / refunded), order_type (sale/rental/mixed), rental_status (booked/active/returned), JSONB shipping/billing addresses |
| order_items | Denormalized line items (product_name/image, unit_price, total_price); is_rental + rental_start/rental_end (rental_end = return-due date) |
| payment_transactions | Razorpay records (order id, payment id, signature, status) |
| coupons | Discount codes (percentage/fixed), min_order_amount, max_uses/used_count, expires_at |
| addresses | Saved user addresses for checkout, is_default |
| device_tokens | FCM push tokens per user/platform, is_active |
| notifications | Push notification history (type, target, sent/failed counts, status) |
| stock_alerts | Back-in-stock subscriptions, unique(product_id, user_id) — migration 004 |
| order_status_history | Order status timeline (status, changed_at) — migration 004 |
| catalog_retrieval_documents | RAG index for assistant/search: content + fts + 768-dim embedding, `hybrid_search_products` fn — migration 007 |
| feedback | Customer feedback (name, email, rating 1-5, message), service-role writes only — migration 009 |

**RPCs**: `increment_coupon_usage`, `decrement_product_stock`, `hybrid_search_products`
**Storage buckets**: product-images, user-avatars, public-downloads

## Code Patterns

### Server vs Client Components
- **Server** (default): Fetch data directly in async components, use `unstable_cache` for revalidation (300s default), stream with Suspense
- **Client** (`"use client"` at top): Interactive UI, hooks, event handlers

### Context Providers
- `[locale]/layout.tsx`: NextIntlClientProvider > AuthProvider > ThemeProvider
- `(store)/layout.tsx`: QueryProvider > NetworkProvider > CartProvider > WishlistProvider > PrefetchProvider (+ Header, Footer, BottomNav, StorefrontAssistant, OfflineBanner, PullToRefresh)

### Custom Hooks
- `useAuth()` - user, profile, isAdmin, isLoading
- `useCart()` - items, itemCount, subtotal, addItem, removeItem, updateQuantity, clearCart
- `useWishlist()` - items, addItem, removeItem, isLoading
- `useNetwork()` - isOnline
- `useMobile()` - mobile breakpoint detection

### Server Actions
Located in `app/*/actions.ts`. Pattern:
1. `"use server"` directive
2. Zod validation on input
3. Supabase query (admin client for writes)
4. Return `{ success, error?, data? }`
5. `revalidatePath()` after mutations

### Data Fetching
- **Client**: TanStack React Query with query key factory in `lib/queries/`
- **Server**: `unstable_cache()` wrapping Supabase queries
- **Forms**: React Hook Form + `zodResolver` with schemas from `lib/validators.ts`

### Offline Support
- localStorage for guest cart snapshots
- IndexedDB operation queue (`lib/operation-queue.ts`) for offline mutations
- Replay on reconnect via `replayQueue()`
- `useNetwork()` hook for status detection

### Store Mode
`NEXT_PUBLIC_STORE_MODE` env var controls online vs offline mode.
- Online: full e-commerce (cart, checkout, orders)
- Offline: catalog-only with WhatsApp contact buttons
- Checked via `IS_ONLINE` constant from `lib/constants.ts`; branching helpers live in `lib/offline-store-ui.ts`

### Rental Products
Products are EITHER for sale OR for rental (`productSchema` enforces mutual exclusivity — rental products must never be sold):
- Priced per day: `rental_discount_price ?? rental_price` × inclusive days (`lib/product-pricing.ts`)
- Add to cart requires a rental period via `RentalDatesDialog` (`components/products/rental-dates-dialog.tsx`), which fetches `/api/rentals/availability` and disables booked dates; dates stored on `cart_items.rental_start/rental_end`
- Checkout (`(store)/checkout/actions.ts`) re-validates server-side: dates present (a rental can never go through the sale path), not past, ≤ max_rental_days, and **no double-booking** (`lib/rental-availability.ts`: peak overlapping booked units + qty must fit `products.stock`; recent pending orders act as soft holds for `PENDING_HOLD_MINUTES` so concurrent checkouts don't double-book, cancelled/refunded release it)
- Orders carry `order_type` (sale/rental/mixed) + `rental_status` lifecycle: paid → `booked`, delivered → `active` (auto), admin "Mark Returned" → `returned`; **overdue is derived** (`isRentalOverdue`), never stored
- Rental lines NEVER decrement stock (stock = rental capacity); sale lines keep the decrement
- `rental_end` is the return-due date shown on cart/confirmation/order pages and appended to the "delivered" push notification (`lib/notifications.ts`)
- Payment is online-only platform-wide (Razorpay is the sole method; no COD/pay-later exists)

## Feature → File Map

| Feature | Pages | Key components | Actions/API | DB tables |
|---|---|---|---|---|
| Browse/filter products | `(store)/products/page.tsx` | products-content, product-filters, product-sort, mobile-filter-sheet, product-card | `lib/queries/products.ts`, GET /api/search/products | products, categories |
| Product detail | `(store)/products/[slug]/page.tsx` | product-detail-content, mobile-detail-bar, add-to-cart-button, rental-dates-dialog, notify-stock-button, wishlist-button | `lib/queries/products.ts` | products, stock_alerts |
| Search (+AI answer) | `(store)/search/page.tsx` | search-results, search-ai-answer, product-search (header) | GET /api/search/products, POST /api/search/answer, `lib/retrieval/` | products, catalog_retrieval_documents |
| Cart | `(store)/cart/page.tsx` | cart-item, cart-summary, cart-sheet, cart-provider | `hooks/use-cart.ts`, `lib/operation-queue.ts` | cart_items |
| Checkout & payment | `(store)/checkout/page.tsx`, `confirmation/page.tsx` | checkout-steps, address-form, coupon-input, payment-button | `(store)/checkout/actions.ts` (createOrder/verifyPayment/applyCoupon), POST /api/webhooks/razorpay | orders, order_items, payment_transactions, coupons, addresses, cart_items |
| Customer orders | `(store)/account/orders/`, `[id]/` | order-status-badge | — | orders, order_items, order_status_history |
| Wishlist | `(store)/wishlist/page.tsx` | wishlist-content, wishlist-button, wishlist-provider | `hooks/use-wishlist.ts` | wishlist_items |
| Account & auth | `(store)/account/`, `(auth)/*`, `app/auth/google/` | login/signup/reset forms, auth-provider | `(store)/account/actions.ts`, /api/auth/{callback,google-token} | profiles, addresses |
| Store info | `(store)/about`, `(store)/visit` | shop-image, external-link | `lib/constants.ts` BUSINESS_INFO | — |
| AI assistant | (widget on store layout) | storefront-assistant, assistant-product-card | POST /api/assistant/chat, `lib/assistant*.ts`, `lib/retrieval/` | catalog_retrieval_documents |
| Feedback | footer dialog | feedback-form | `(store)/feedback/actions.ts` | feedback |
| Admin catalog | `admin/products/`, `admin/categories/` | product-form, products-table, categories-manager, ai-image-compare-dialog | `admin/actions.ts` (CRUD + DeepL + retrieval sync), POST /api/ai/enhance-image | products, categories, catalog_retrieval_documents |
| Admin orders | `admin/orders/`, `[id]/` | orders-table, order-status-updater | `admin/actions.ts` updateOrderStatus | orders, order_status_history |
| Admin users/coupons | `admin/users/`, `admin/coupons/` | users-table, coupons-manager | `admin/actions.ts` | profiles, coupons |
| Push notifications | `admin/notifications/` | notification-composer, notifications-table | /api/notifications/*, `lib/notifications.ts`, `lib/push-notifications.ts` | device_tokens, notifications |
| Social share preview | `app/preview/[slug]/route.ts` | share-button | `lib/share.ts` | products |

## Business Rules Index

| Rule | Implemented in |
|---|---|
| Store mode ONLINE/OFFLINE gating | `lib/constants.ts` (IS_ONLINE), `lib/offline-store-ui.ts`, checkout actions throw when OFFLINE |
| Shipping ₹49, free ≥ ₹999 | `lib/constants.ts:SHIPPING_COST/FREE_SHIPPING_THRESHOLD`; applied in `checkout/actions.ts`, previewed in cart-summary |
| Sale pricing (`discount_price ?? price`) & rental pricing (per-day × days) | `lib/product-pricing.ts` (getCartLineUnitPrice) — used by use-cart subtotal, cart-item, checkout actions, product cards |
| Rental period constraints (start ≥ today, ≤ max_rental_days) | UI: `lib/offline-store-ui.ts:getRentalDateConstraints`; server: `checkout/actions.ts` createOrder |
| Rental availability / no double-booking | `lib/rental-availability.ts` (peak overlap vs stock); enforced in `checkout/actions.ts`; advisory in dialog via GET /api/rentals/availability |
| Rental lifecycle booked→active→returned (+derived overdue) | set in verifyPayment/webhook (booked), `admin/actions.ts` updateOrderStatus (active on delivered), markRentalReturned; `isRentalOverdue` for display |
| Rental products never sold / flags mutually exclusive | `lib/validators.ts:productSchema`; `checkout/actions.ts` requires rental dates; rental lines skip stock decrement |
| Quantity cap 10 per product (client-side) | add-to-cart-button, product-card stepper |
| Stock: display overlay / enforce at checkout / decrement on payment | `offline-store-ui.ts:shouldShowSoldOutOverlay`; `checkout/actions.ts`; RPC `decrement_product_stock` (webhook + verifyPayment) |
| Coupon validation (active, min amount, max uses, expiry) | `checkout/actions.ts` (admin client — coupons RLS has no read policy); usage via RPC `increment_coupon_usage` |
| Order lifecycle + per-status push notification | statuses in `lib/constants.ts:ORDER_STATUSES`; transitions: webhook/verifyPayment (→paid), `admin/actions.ts:updateOrderStatus`; history in order_status_history; templates in `lib/notifications.ts` |
| Payment integrity (HMAC verify, idempotent paid transition) | `lib/razorpay/verify.ts`, `/api/webhooks/razorpay` |
| Admin access (profiles.role === "admin") | `admin/layout.tsx` (all /admin pages), per-route checks in /api/notifications/send*, /api/ai/enhance-image |
| Guest cart merge on login; offline mutation replay | `hooks/use-cart.ts` (mergeLocalCartToDB), `lib/operation-queue.ts` |
| Retrieval index sync on product/category mutations | `admin/actions.ts` → `lib/retrieval/catalog.ts` syncProductRetrievalDocument(s) |
| Bilingual content (name_telugu fallback to en) | `lib/i18n-helpers.ts`; admin DeepL via `translateToTelugu` |
| Assistant guardrails (rate limit, size caps, PII redaction, WhatsApp handoff for order/account/payment topics) | `/api/assistant/chat`, `lib/assistant.ts`, `lib/assistant-config.ts` |

## Playbooks

- **New storefront page**: create `src/app/[locale]/(store)/<name>/page.tsx` (server component), add route to `lib/constants.ts:ROUTES`, add namespace JSON to `messages/en/` AND `messages/te/`, breadcrumbs via `components/shared/breadcrumbs`.
- **New product field**: migration in `supabase/migrations/` + update `supabase/schema.sql` → `types/database.ts` Row/Insert/Update → `lib/validators.ts:productSchema` → `components/admin/product-form.tsx` → display components (product-detail-content / product-card) → if searchable, resync retrieval index. Add to `PRODUCT_LIST_FIELDS` in `lib/queries/products.ts` if cards need it.
- **New pricing/business rule**: put the calculation in `lib/product-pricing.ts` or `lib/constants.ts` (never inline in components); apply server-side in `checkout/actions.ts` (client math is preview-only).
- **New admin entity**: page under `src/app/admin/<name>/page.tsx` (auth inherited from admin layout), manager component in `components/admin/`, server actions in `app/admin/actions.ts` with a Zod schema in `lib/validators.ts`, `revalidatePath` after writes.
- **New push notification type**: template + sender in `lib/notifications.ts`, admin trigger via `/api/notifications/send-product` or composer; always log to `notifications` table and deactivate stale tokens.
- **New API route**: `src/app/api/<name>/route.ts`; if admin-only, copy the guard from `/api/notifications/send/route.ts`; middleware skips i18n for /api automatically.
- **New translation namespace**: add `<name>.json` to BOTH `messages/en/` and `messages/te/` (next-intl loads per-namespace; missing te file breaks the te locale).

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `product-card.tsx`, `use-auth.ts` |
| Components | PascalCase | `ProductCard`, `AuthProvider` |
| Functions/variables | camelCase | `handleSubmit`, `isLoading` |
| Booleans | is/has/can/should prefix | `isAdmin`, `hasItems` |
| Constants | UPPER_SNAKE_CASE | `PRODUCTS_PER_PAGE` |
| Props interfaces | ComponentNameProps | `ProductCardProps` |

## Styling

- **Tailwind CSS v4** with CSS variables (via `@tailwindcss/postcss`)
- **Mobile-first**: base classes for mobile, `md:` / `lg:` for larger screens
- **Dark mode**: `dark:` prefix via next-themes
- **Utility**: `cn()` from `lib/utils.ts` (clsx + tailwind-merge)
- **Brand color**: `#7a462e`
- **No CSS modules** - all styling via Tailwind utility classes

## Internationalization

- **Locales**: `en` (default, no URL prefix), `te` (Telugu, `/te/` prefix)
- **Library**: next-intl with App Router integration
- **Translation files**: `messages/{locale}/*.json` (common, home, products, constants, about, auth, account, cart, wishlist, search, legal, feedback)
- **Telugu font**: Noto Sans Telugu loaded conditionally
- **Admin translations**: DeepL API via `translateToTelugu` server action
- **Usage**: `const t = useTranslations('namespace')`

## Authentication & Authorization

- **Supabase Auth**: email/password + Google OAuth
- **Sessions**: secure httpOnly cookies via `@supabase/ssr`
- **Role**: `profiles.role` field (customer | admin)
- **Admin check**: `useAuth().isAdmin` in client, RLS policies on server
- **Middleware**: refreshes session + handles i18n routing

## Import Convention

Always use the `@/` path alias. No relative imports.

```typescript
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import type { Product } from "@/types/product";
```

## Type Patterns

Database types follow Supabase's pattern in `types/database.ts`:
```typescript
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
```

Domain types extend with joins:
```typescript
export type ProductWithCategory = Product & { category: Category | null };
```

## Environment Variables

### Public (NEXT_PUBLIC_*)
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RAZORPAY_KEY_ID`, `STORE_MODE`, `CONFETTI_ENABLED`, `SHOW_APP_BANNER`, `SITE_URL`, `PLAY_STORE_URL`, `GOOGLE_CLIENT_ID`

- `SITE_URL` — canonical origin for SEO metadata, `robots.ts`, `sitemap.ts`, and OG/share previews (falls back to `https://bfg.darisi.in`).
- `PLAY_STORE_URL` — Play Store link for the install-app banner (replaces the former `APK_URL`; banner hides when unset).

### Private
`SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`, `GEMINI_API_KEY`, `DEEPL_AUTH_KEY`, `FIREBASE_SERVICE_ACCOUNT_KEY`, `DEV_SERVER_URL`

- `FIREBASE_SERVICE_ACCOUNT_KEY` is the only Firebase value read from the environment (server-side admin SDK). The client push config ships via native `google-services.json` / `GoogleService-Info.plist` at build time, not env vars.
- `DEV_SERVER_URL` — LAN IP for Capacitor live-reload dev only (`capacitor.config.ts`); never set in production.

### Test-only
`NEXT_PUBLIC_E2E_TEST_MODE` — set to `1` by the Playwright config to enable offline-store fixtures; unset in dev/prod.

## Scripts

```bash
npm run dev          # Next.js dev server (port 3000)
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run cap:sync     # Sync to native projects
npm run cap:android  # Open Android Studio
npm run cap:ios      # Open Xcode
npm run cap:dev      # Live reload Android
npm run cap:install  # Build + install APK
npm run cap:release  # Build AAB for Play Store
npm run cap:clean    # Clean native builds
```

## Security

- RLS on all user-scoped tables
- Service role key server-only (never in client bundle)
- Razorpay webhook signature verified via HMAC-SHA256
- Supabase Storage bucket policies restrict access
- React escaping prevents XSS
- Next.js middleware handles CSRF

## Workflow Orchestration

### 1. Plan First

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Git Conventions

- **No Co-Authored-By**: Never add `Co-Authored-By` lines to commit messages.

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
