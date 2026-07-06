# BFG Codebase Analysis — Functional + Business Map

> Generated 2026-07-02 from full codebase exploration. Source material for the CLAUDE.md rewrite.
> Every claim is backed by a file path; line numbers were verified at generation time.

---

## Phase 1 — Discovery

**Framework**: Next.js 16 App Router (Turbopack), React 19, TypeScript strict, Tailwind v4, shadcn/ui.
**Routing**: Three route trees, split by `src/middleware.ts:8-27`:
- `src/app/[locale]/` — localized storefront + auth (next-intl, `en` default / `te` prefixed)
- `src/app/admin/` — non-localized admin panel (session refresh only, no i18n)
- `src/app/api/`, `src/app/auth/google/`, `src/app/preview/`, `.well-known/` — non-localized handlers

**State**: Server components + `unstable_cache` (300s) for reads; TanStack Query client-side (key factory `src/lib/queries/keys.ts`); React contexts Auth > Cart > Wishlist > Network; IndexedDB operation queue for offline mutations (`src/lib/operation-queue.ts`).

**Database (15 tables)** — `supabase/schema.sql` + `supabase/migrations/`:
profiles, addresses, categories, products, cart_items, wishlist_items, coupons, orders, order_items, payment_transactions, device_tokens, notifications (schema.sql), stock_alerts + order_status_history (migration 004), catalog_retrieval_documents with 768-dim vector embeddings + `hybrid_search_products` function (migration 007).
⚠️ `feedback` table is used (`src/app/[locale]/(store)/feedback/actions.ts`) and indexed (migration 008:74) but has **no CREATE TABLE in the repo**.

**Third-party**: Supabase (DB/auth/storage), Razorpay (payments), Resend (email), Firebase FCM via Capacitor (push), Google Gemini (image enhancement + assistant/RAG), DeepL (admin Telugu translation), GA4 (`src/lib/gtag.ts`, events: add_to_cart, purchase, begin_checkout, apply_coupon, contact_whatsapp, payment_failed, add_stock_alert), Capacitor (Android/iOS wrapper, haptics, network, background tasks).

---

## Phase 2 — Pages & Routes

### Layout stack
| File | Provides |
|---|---|
| `src/app/layout.tsx` | Fonts (Marcellus/Cormorant/Hanken/Noto Telugu), GA (G-NKL5JQS5W6), SW registration, CapacitorInit |
| `src/app/[locale]/layout.tsx` | `dynamic="force-dynamic"`, NextIntlClientProvider, AuthProvider, ThemeProvider, NavProgress, Toaster, OnboardingScreen, SEO metadata |
| `src/app/[locale]/(store)/layout.tsx` | Header (getTopCategories), Footer, BottomNav, CartProvider, WishlistProvider, QueryProvider, NetworkProvider, StorefrontAssistant, PullToRefresh, OfflineBanner, PrefetchProvider |
| `src/app/[locale]/(auth)/layout.tsx` | Split brand panel + form; no auth check |
| `.../account/layout.tsx` | Breadcrumbs + AccountSidebar + AccountMobileNav |
| `src/app/admin/layout.tsx:23-38` | **Admin guard**: getAuthUser → /login; profiles.role !== "admin" → / |

### Storefront pages
| Route | Rendering | Auth | Tables | Business rules |
|---|---|---|---|---|
| `/` | Server, unstable_cache 300s | No | products, categories | IS_ONLINE swaps trust bar + newsletter-vs-visit CTA; hero CTA → marriage-rental-sets; offline E2E fixtures; JSON-LD (Org/JewelryStore/FAQ) |
| `/products` | Server shell + `ProductsContent` client | No | products, categories | Filters: category/material/minPrice/maxPrice/sort/page/type/tag/q. `type=sale`→is_sale, `rental`→is_rental. Price filter uses rental_price fields for rentals, price fields for sale. 12/page |
| `/products/[slug]` | Server, cache 300s, generateStaticParams revalidate 3600 | No | products | Price display via `getProductSearchPriceDisplay` (`src/lib/product-pricing.ts`); rental "/day"; 4 related same-category; ProductCacheWriter |
| `/search` | Server + SearchResults client | No | products (hybrid FTS+vector via `src/lib/retrieval/catalog.ts` searchProducts) | Bilingual; AI answer via search-ai-answer → /api/search/answer |
| `/cart` | Client (useCart) | No — guest = localStorage/IDB | cart_items | Free shipping ≥₹999 else ₹49 |
| `/checkout` | Client, steps address→coupon→pay | Yes (redirect) | addresses + actions | Addresses fetched inside onAuthStateChange to avoid RLS race |
| `/checkout/confirmation` | Server | RLS | orders, order_items | |
| `/wishlist` | Server + client | Yes | wishlist_items, products | Fetches PRODUCT_LIST_FIELDS only (perf) |
| `/account` | Client | Yes | profiles | changePassword verifies current pw via admin signIn; deleteMyAccount needs typed "DELETE" |
| `/account/orders` | Server | Yes | orders | newest first |
| `/account/orders/[id]` | Server | Yes + ownership | orders, order_items, order_status_history | Timeline pending→paid→processing→shipped→delivered; cancelled/refunded skip timeline |
| `/account/addresses` | Client | Yes | addresses | CRUD; is_default = unset-all-then-set |
| `/about`, `/visit` | Server | No | — | BUSINESS_INFO (constants.ts:112-139): hours, WhatsApp, maps embed |
| `/privacy-policy`, `/terms-and-conditions` | Server | No | — | legal, rental terms |
| `/login /signup /forgot-password /reset-password` | Server wrapping client forms | No | Supabase auth | |
| `/auth/google` (non-localized) | Client | No | — | id_token from URL hash; Android Intent / iOS scheme / web POST /api/auth/google-token |
| `/preview/[slug]` | Route handler | No | products | OG/Twitter meta for WhatsApp shares, cache 1h |

### Server actions
**`(store)/checkout/actions.ts`** — the money path:
- `createOrder`: OFFLINE mode throws (lines 14,192,255) · stock validation vs product.stock (42-47) · **unit price = discount_price ?? price (55) — sale pricing only** · coupon validation via admin client (59-91: is_active, min_order_amount, max_uses vs used_count, expires_at; percentage|fixed at 87-89) · shipping ₹49 waived ≥₹999 (93) · order "pending" (104) + order_status_history + order_items · Razorpay order in paise (156) · payment_transactions "created" (166) · RPC `increment_coupon_usage` (175)
- `verifyPayment`: HMAC verify → txn "captured", order "paid", RPC `decrement_product_stock` (240), clear cart
- `applyCoupon`: same validation, returns discount preview

**`(store)/account/actions.ts`**: changePassword, deleteMyAccount (admin auth APIs).
**`(store)/feedback/actions.ts`**: submitFeedback → `feedback` insert + `sendFeedbackNotificationEmail`; autofills from profile.

**`admin/actions.ts`** (all admin mutations in one file):
- `translateToTelugu` (20-41): DeepL
- `createProduct`/`updateProduct` (95-240): productSchema Zod (must be sale OR rental), price rounding, slug dedup w/ random suffix (122-134), **syncProductRetrievalDocument** (150/217) → returns retrievalStatus, revalidatePath
- `deleteProduct` (246-279): deletes storage images (product-images bucket) + retrieval doc
- `updateOrderStatus` (290-311): orders update + order_status_history insert + **push notification** + revalidate
- category CRUD (320-413): hierarchy via getCategoryDescendantIds (62-86); update/delete **reindexes descendant products**; no Zod
- `updateUserRole`, `deleteUser`, `toggleUserDisabled` (ban "876600h")
- coupon CRUD (470-533): couponSchema (validators.ts:58-70)

### Admin pages (all guarded by `admin/layout.tsx`)
| Route | Data | Component |
|---|---|---|
| `/admin` | revenue (paid/processing/shipped/delivered orders), counts, retrieval health, 10 recent orders, 30-day chart | RevenueChart, StatsCard |
| `/admin/products` (+new, +[id]/edit) | products+categories; `copyFrom` param prefill | ProductsTable, ProductForm |
| `/admin/orders` (+[id]) | 100 recent + profile emails; order+items+payments | OrdersTable, OrderStatusUpdater |
| `/admin/categories` | all categories | CategoriesManager |
| `/admin/users` | profiles + auth listUsers + banned_until | UsersTable |
| `/admin/coupons` | all coupons | CouponsManager |
| `/admin/notifications` | 100 recent | NotificationComposer, NotificationsTable |

### API routes
| Route | Auth | Purpose |
|---|---|---|
| POST `/api/webhooks/razorpay` | HMAC-SHA256 signature | payment.captured → txn captured, order pending→paid (idempotent guard line 48), RPC stock decrement, clear cart, push notify; payment.failed → txn failed |
| POST `/api/assistant/chat` | public, per-IP rate limit (282-326) | RAG assistant: sanitize → intent (handoff/template/product) → retrieveCatalogContext + public docs → Gemini grounded reply → product recommendations; broaden-and-retry; en/te |
| POST `/api/search/answer` | public | one-shot grounded search answer (retrieval limit 6) |
| GET `/api/search/products` | public | hybrid search w/ facets (limit clamp 1-24) |
| POST `/api/ai/enhance-image` | ⚠️ **NO AUTH** | Gemini `gemini-2.5-flash-image` product photo enhancement (admin tool, publicly callable) |
| GET `/api/auth/callback` | — | code→session; open-redirect protection |
| POST `/api/auth/google-token` | — | signInWithIdToken |
| POST `/api/notifications/register-token` | optional session | upsert device_tokens |
| POST `/api/notifications/send` | admin | broadcast/topic/user push; deactivates stale tokens; logs to notifications table |
| POST `/api/notifications/send-product` | admin | price_drop / new_product / back_in_stock |
| GET `/.well-known/assetlinks.json` | public | Android App Links |

---

## Phase 3 — Shared Components (reverse map)

### Providers (composed in (store)/layout.tsx)
- **AuthProvider** (`src/components/auth/auth-provider.tsx`): user/profile/isAdmin/isLoading. Capacitor LockManager hang workarounds: 3s safety timeout + cached localStorage user (14-23, 111-120); 10s getUser timeout on resume (130-166); re-verify after >60s hidden (172-180). Consumed by: everything.
- **CartProvider** (`src/components/cart/cart-provider.tsx`): items/subtotal/itemCount + mutations. Guest cart in localStorage "bhagylakshmi-future-gold-cart" (30); **merge to DB on login via upsert** (142-156); optimistic updates + offline queue fallback (223-267); price refresh on reconnect (102-140). Consumed by: add-to-cart-button, cart-sheet/summary/item, header, bottom-nav, product-card, product-detail-content, checkout, storefront-assistant.
- **WishlistProvider** (`src/components/wishlist/wishlist-provider.tsx`): product-ID list. Guest = localStorage "bfg-wishlist" only (19, 91-98); reconnect delta-sync (112-161); invalidates queryKeys.wishlist (192, 217). Consumed by: wishlist-button, product-card, product-detail-content, bottom-nav, header.

### Business-logic-bearing components
| Component | Embedded rules |
|---|---|
| `cart/add-to-cart-button.tsx` | stock===0 disable (23); **qty cap 10** (56); GA add_to_cart; haptics; morphs to stepper when in cart (49-64) |
| `checkout/payment-button.tsx` | Razorpay modal; verifyPayment w/ signature; GA begin_checkout/purchase/payment_failed; disabled until script loads (121) |
| `checkout/coupon-input.tsx` | delegates to applyCoupon action (36) w/ subtotal for min_order check; GA apply_coupon |
| `products/product-card.tsx` | sold-out overlay = IS_ONLINE && stock===0 (39); rental-only pricing "/day" (50-54); stepper only if IS_ONLINE && !is_rental (43); IS_ONLINE ? cart : WhatsApp quick action; stepper cap 10 (91) |
| `products/product-detail-content.tsx` | React Query refetch staleTime 2min; rental pricing block w/ deposit + max_rental_days (97-133); marriage-rental-sets disclaimer (128-131); action from getProductDetailDisplayState (138-149) |
| `products/check-availability-button.tsx` | OFFLINE/rental WhatsApp inquiry; rental date constraints via getRentalDateConstraints (109-113); GA contact_whatsapp |
| `products/notify-stock-button.tsx` | requires login; inserts stock_alerts; GA add_stock_alert |
| `shared/price-display.tsx` | calculateDiscount; strike-through only if discountPrice<price; % badge |
| `products/product-filters.tsx` | category tree from parent_id (37-47); deferred vs immediate mode; price slider 0-10000 |
| `assistant/storefront-assistant.tsx` | session storage "bfg-storefront-assistant-session" v3; msg caps (user 1024); 30-message rolling window; PII redaction (74-84); ≤3 product recs; never mutates cart |
| `layout/header.tsx` / `bottom-nav.tsx` | badges from cart/wishlist counts; admin link if isAdmin; bottom-nav hidden on /checkout,/admin (39); IS_ONLINE swaps About/Visit tab (59); prefetch on touch |
| Pure UI (no rules) | breadcrumbs, pagination, empty-state, loading-skeleton, section-heading, logo, theme-*, language-switcher, shop-image, external-link, share-button, scroll-to-top, confetti, bfg-animate |

### Key lib modules
- `lib/product-pricing.ts` — single source of card/search price display (rental-only detection, discount, /day)
- `lib/offline-store-ui.ts` — **store-mode branching brain**: shouldShowSoldOutOverlay, getProductDetailDisplayState, getWishlistPrimaryActionMode, buildAvailabilityMessage / buildRentalAvailabilityMessage (WhatsApp), getRentalDateConstraints
- `lib/queries/products.ts` — fetchProducts (delegates to /api/search/products when q present; offline fixtures), fetchProduct, fetchRelated/Featured/New/WishlistProducts, PRODUCT_LIST_FIELDS
- `lib/operation-queue.ts` — IDB queue, ops: cart-add/update/remove/clear, wishlist-add/remove; 5 retries; replay on reconnect + Background Sync
- `lib/retrieval/` — catalog.ts (hybrid search + index sync + health), answer.ts (grounded generation), public-documents.ts (store_info/faq/legal docs)
- `lib/assistant*.ts` — intent parsing, templated replies, WhatsApp handoff w/ PII redaction, product recommendation ranking, config caps
- `lib/notifications.ts` — sendOrderStatusNotification (per-status templates), sendProductNotification (price_drop→wishlisters, new_product/back_in_stock→broadcast); stale-token deactivation
- `lib/push-notifications.ts` — FCM init/permission/token registration, "all_users" topic, tap navigation
- `lib/validators.ts` — Zod: login/signup/address/coupon/product/feedback; productSchema enforces is_sale OR is_rental
- `lib/formatters.ts` — formatPrice (₹ en-IN), calculateDiscount, formatDate(Time), generateSlug, generateOrderNumber
- `lib/i18n-helpers.ts` — getProductName/Description, getCategoryName (te falls back to en)
- `lib/supabase/` — client (RLS), server (cookies), admin (service role), middleware (session refresh), storage
- `lib/haptics.ts`, `lib/gtag.ts`, `lib/share.ts`, `lib/product-cache.ts` (localStorage 20×30min), `lib/prefetch.ts`, `lib/image-preloader.ts` (SW cache), `lib/background-task.ts`, `lib/offline-store-fixtures.ts` (E2E)

---

## Business Rules Index (rule → implementation)

| Rule | Where |
|---|---|
| Store mode ONLINE/OFFLINE | `lib/constants.ts:1-2` (IS_ONLINE); branching in `lib/offline-store-ui.ts`; checkout actions throw when OFFLINE; home/bottom-nav CTA swaps |
| Shipping ₹49, free ≥₹999 | constants.ts:159-160; applied checkout/actions.ts:93; previewed cart-summary |
| Sale pricing | discount_price ?? price — checkout/actions.ts:55, price-display, product-pricing.ts |
| Rental pricing | rental_price / rental_discount_price / rental_deposit / max_rental_days — product-detail-content.tsx:97-133; card :50-54; **checkout does NOT price rentals** |
| Rental dates | getRentalDateConstraints (offline-store-ui.ts) via check-availability-button:109-113 |
| Qty cap 10/product | add-to-cart-button.tsx:56, product-card.tsx:91 (client-only) |
| Stock | display: sold-out overlay (offline-store-ui.ts:19); enforce: checkout/actions.ts:42-47; decrement: RPC on payment (webhook:60, verifyPayment:240) |
| Coupons | validation checkout/actions.ts:59-91; RPC increment_coupon_usage; admin CRUD actions.ts:470-533; admin-only RLS |
| Order lifecycle | pending→paid→processing→shipped→delivered (+cancelled/refunded); transitions: webhook/verifyPayment (→paid), admin updateOrderStatus; history in order_status_history; push per transition |
| Payment integrity | HMAC verify (lib/razorpay/verify.ts) in webhook + verifyPayment; idempotent paid transition (webhook:48) |
| Admin access | admin/layout.tsx:23-38 (profiles.role) + RLS |
| Guest→user cart merge | cart-provider.tsx:142-156 |
| Offline mutations | operation-queue.ts (IDB, 5 retries, replay) |
| Retrieval index sync | admin/actions.ts:150,217,272,364-413 on every product/category mutation |
| Bilingual content | *_telugu columns + i18n-helpers.ts; messages/{en,te}/*.json; DeepL in admin |
| Free-text search | hybrid_search_products fn (migration 007) via lib/retrieval/catalog.ts |
| Assistant guardrails | api/assistant/chat: rate limit, size caps, PII redaction, WhatsApp handoff for orders/account/payment topics (lib/assistant.ts:484-529) |

---

## Open Questions / Flags — RESOLVED 2026-07-02

1. ~~`/api/ai/enhance-image` has no auth~~ → admin guard added (same pattern as /api/notifications/send).
2. ~~Rental checkout gap~~ → full rental flow built: RentalDatesDialog on add-to-cart, per-day × days pricing via `lib/product-pricing.ts:getCartLineUnitPrice`, cart_items/order_items rental columns (migration 009), server-side date validation in checkout, return-by date on cart/confirmation/order pages + delivered push notification.
3. ~~feedback table missing CREATE TABLE~~ → defined in migration 009 + schema.sql (was already live in prod).
4. ~~Category actions no Zod~~ → `categorySchema` added to validators.ts, wired into create/updateCategory.
5. ~~CLAUDE.md staleness~~ → rewritten 2026-07-02 (structure, 16 tables, Feature→File Map, Business Rules Index, Playbooks).

Note: pre-existing issue observed during verification — guest `/cart` page can hang on the loading spinner (cart isLoading gated on auth init) in the dev-preview browser; reproduces with an EMPTY cart, so unrelated to the rental change. Worth investigating separately.
