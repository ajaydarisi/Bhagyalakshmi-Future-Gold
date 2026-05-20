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
      (store)/             # Storefront: home, products, cart, checkout, account, wishlist, search
      (auth)/              # Auth: login, signup, reset-password
    admin/                 # Admin panel (not localized): dashboard, products, orders, categories, users, coupons, notifications
    api/                   # API routes: auth callback, razorpay webhook, notifications, ai
  components/
    ui/                    # shadcn/ui primitives (button, card, dialog, form, input, etc.)
    layout/                # header, footer, mobile-nav, bottom-nav, admin-sidebar, account-sidebar
    products/              # product-grid, product-card, product-filters, product-sort, product-detail
    cart/                  # cart-provider, cart-sheet, cart-summary, cart-item, add-to-cart-button
    checkout/              # checkout-steps, address-form, coupon-input, payment-button
    wishlist/              # wishlist-provider, wishlist-button
    auth/                  # login-form, signup-form, auth-provider, google-oauth-button
    shared/                # theme-provider, language-switcher, breadcrumbs, pagination, price-display, offline-banner, etc.
    admin/                 # data-table, product-form, orders-table, stats-card, revenue-chart, notification-composer
    home/                  # featured-products-section, new-arrivals-section
    providers/             # query-provider
  hooks/                   # use-auth, use-cart, use-wishlist, use-mobile, use-network, use-debounce, use-prefetch
  types/                   # database.ts, product.ts, order.ts, cart.ts, user.ts
  lib/
    supabase/              # client.ts, server.ts, admin.ts, middleware.ts, storage.ts
    razorpay/              # client.ts, verify.ts
    queries/               # products.ts (fetchProducts with filtering), keys.ts
    ai/                    # enhance-image.ts (Gemini)
    constants.ts           # Routes, business info, store mode (IS_ONLINE)
    validators.ts          # Zod schemas (auth, products, coupons, addresses)
    formatters.ts          # Price, date, slug formatting
    utils.ts               # cn() (clsx + tailwind-merge)
    operation-queue.ts     # IndexedDB offline mutation queue
    idb-helpers.ts         # IndexedDB utilities
    firebase-admin.ts      # Firebase admin init
    email.ts               # Resend email templates
    notifications.ts       # Push notification helpers
    haptics.ts             # Capacitor haptics
    gtag.ts                # Google Analytics events
  i18n/                    # config.ts, routing.ts, request.ts
  middleware.ts            # i18n routing + Supabase session refresh
messages/
  en/                      # common, home, products, constants, about, auth, account, cart, wishlist, search, legal, feedback
  te/                      # Same structure, Telugu translations
supabase/                  # schema.sql, migrations/, seed.sql, storage.sql
android/                   # Capacitor Android project
ios/                       # Capacitor iOS project
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
| products | Catalog items, bilingual name/description, price/discount_price, rental fields, images[], slug |
| categories | Hierarchical with bilingual names, slug, parent_id, order |
| cart_items | Persisted cart (synced with localStorage for guests), unique(user_id, product_id) |
| wishlist_items | Favorite products, unique(user_id, product_id) |
| orders | Order records, status enum, JSONB shipping/billing addresses |
| order_items | Line items with denormalized product_snapshot for price preservation |
| payment_transactions | Razorpay records with signature verification |
| coupons | Discount codes (percentage/fixed), usage limits, date ranges |
| addresses | Saved user addresses for checkout |

**Storage buckets**: product-images, user-avatars, public-downloads

## Code Patterns

### Server vs Client Components
- **Server** (default): Fetch data directly in async components, use `unstable_cache` for revalidation (300s default), stream with Suspense
- **Client** (`"use client"` at top): Interactive UI, hooks, event handlers

### Context Providers (composed in `[locale]/layout.tsx`)
AuthProvider > CartProvider > WishlistProvider > ThemeProvider > QueryProvider > PrefetchProvider

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
- Checked via `IS_ONLINE` constant from `lib/constants.ts`

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
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RAZORPAY_KEY_ID`, `STORE_MODE`, `CONFETTI_ENABLED`, `SHOW_APP_BANNER`, `APK_URL`, `GOOGLE_CLIENT_ID`

### Private
`SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_API_KEY`, `OLLAMA_HOST`, `OLLAMA_EMBEDDING_MODEL`, `OLLAMA_GENERATION_MODEL`, `DEEPL_AUTH_KEY`, `FIREBASE_*` (project number, ID, storage bucket, app ID, API key, service account key), `DEV_SERVER_URL`

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
