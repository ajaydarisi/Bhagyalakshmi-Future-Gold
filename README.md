# Bhagyalakshmi Future Gold

A full-stack jewelry e-commerce platform built with Next.js 16, React 19, and Supabase. Features a customer-facing storefront with bilingual support (English & Telugu), a comprehensive admin panel, and Razorpay payment integration.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4, shadcn/ui, Radix UI |
| Language | TypeScript 5 |
| Database & Auth | Supabase (PostgreSQL, Auth, Storage) |
| Payments | Razorpay |
| i18n | next-intl v4 |
| Forms | React Hook Form + Zod validation |
| Charts | Recharts |
| Email | Resend |

## Features

### Storefront

- **Product Catalog** — Browse products with advanced filtering (category hierarchy, material, price range, sale/rental type), sorting, full-text search, and pagination
- **Product Detail** — Image carousel, pricing with discount display, stock availability, related products
- **Shopping Cart** — Persistent cart with optimistic updates; localStorage for guests, Supabase sync for logged-in users
- **Wishlist** — Save favorite products (requires authentication)
- **Checkout** — Multi-step flow with address management, coupon codes, and Razorpay payment
- **Order Tracking** — View order history and individual order details
- **Account Management** — Profile, saved addresses, order history
- **Authentication** — Email/password and Google OAuth via Supabase Auth

### Admin Panel (`/admin`)

- **Dashboard** — Revenue stats, order counts, product/user totals, 30-day revenue chart, recent orders
- **Products** — Full CRUD with bilingual fields (English/Telugu), image management via Supabase Storage, rental product support
- **Categories** — Hierarchical category management with Telugu translations
- **Orders** — View orders, update statuses (pending → paid → processing → shipped → delivered)
- **Users** — View user profiles, manage roles (customer/admin)
- **Coupons** — Create and manage discount codes (percentage or fixed amount)

### Platform Features

- **Bilingual Support** — English (default, no URL prefix) and Telugu (`/te/` prefix) with 9 translation namespaces
- **Dual Store Mode** — Online (full e-commerce) or Offline (catalog-only with WhatsApp contact); see [Store Modes](#store-modes) below
- **Dark/Light Theme** — System-aware theme toggle via next-themes
- **Responsive Design** — Mobile-first with adaptive grids, mobile filter sheets, and hamburger navigation
- **Rental Products** — Support for rental pricing, deposits, and max rental days
- **Grounded Streaming Voice Shopping Assistant** — Interactive English/Telugu voice turns wait for the customer to finish, stream grounded answer text and sentence-level TTS, support barge-in, and retain the same product imagery and citations as typed Ask AI; see the [production guide](docs/voice-assistant-production.md)

### Store Modes

The app supports two modes controlled by `NEXT_PUBLIC_STORE_MODE` (defaults to `ONLINE`). The `IS_ONLINE` constant from `src/lib/constants.ts` conditionally renders features across the header, footer, mobile nav, product cards, product detail, homepage, wishlist, and account sidebar.

#### Online Mode (`ONLINE`)

Full e-commerce experience with purchasing capabilities:

- **Cart & Checkout** — Add to Cart button on product pages, cart icon in header/mobile nav, multi-step checkout with Razorpay payments
- **Order Management** — Orders and addresses sections visible in account sidebar and user dropdown
- **Stock Display** — Product detail shows stock availability; out-of-stock overlay on product cards
- **Trust Bar** — Homepage highlights free shipping, easy returns, secure payments, and 24/7 support

#### Offline Mode (`OFFLINE`)

Catalog-only experience designed for physical store walk-ins:

- **No Cart or Checkout** — Cart icon, checkout flow, orders, and addresses are hidden from all navigation
- **WhatsApp Contact** — Product detail shows a "Check Availability" WhatsApp button instead of Add to Cart; wishlist shows "Enquire on WhatsApp" instead of Add to Cart
- **Wishlist CTA** — Homepage displays a dedicated wishlist call-to-action section
- **Trust Bar** — Homepage highlights store visit, quality assurance, rental availability, and custom orders

## Project Structure

```
src/
├── app/
│   ├── [locale]/(store)/     # Localized store pages (home, products, cart, checkout, account, etc.)
│   ├── [locale]/(auth)/      # Auth pages (login, signup, forgot/reset password)
│   ├── admin/                # Admin panel (not localized)
│   └── api/                  # API routes (auth callback, Razorpay webhook)
├── components/
│   ├── auth/                 # Auth forms and providers
│   ├── cart/                 # Cart provider, sheet, items, summary
│   ├── checkout/             # Checkout steps, address form, payment
│   ├── layout/               # Header, footer, mobile nav, admin sidebar
│   ├── products/             # Product grid, card, filters, sort, search
│   ├── shared/               # Theme toggle, language switcher, breadcrumbs, pagination
│   ├── ui/                   # shadcn/ui components
│   └── wishlist/             # Wishlist provider and button
├── hooks/                    # Custom hooks (useAuth, useCart, useWishlist, useDebounce, useMobile)
├── i18n/                     # Internationalization config, routing, request handling
├── lib/
│   ├── supabase/             # Supabase clients (server, client, admin, middleware, storage)
│   ├── razorpay/             # Razorpay client and signature verification
│   ├── constants.ts          # App constants (routes, categories, materials, shipping, business info)
│   ├── validators.ts         # Zod schemas for products, coupons, addresses, auth
│   └── formatters.ts         # Date and number formatting utilities
├── types/                    # TypeScript types (product, order, cart, user, database)
└── middleware.ts             # Composes next-intl + Supabase session middleware
messages/
├── en/                       # English translations (9 namespaces)
└── te/                       # Telugu translations
supabase/
├── schema.sql                # Full database schema with RLS policies
├── migrations/               # Schema migrations
└── seed.sql                  # Seed data
```

## Getting Started

### Prerequisites

- Node.js 22+
- npm, pnpm, or yarn
- A [Supabase](https://supabase.com) project
- A [Razorpay](https://razorpay.com) account (for payments)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd Bhagyalakshmi-Future-Gold

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file with the following:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# Resend (Email)
RESEND_API_KEY=your_resend_api_key

# Store Mode
NEXT_PUBLIC_STORE_MODE=ONLINE  # or OFFLINE
```

### Database Setup

1. Run `supabase/schema.sql` in your Supabase SQL editor to create all tables, indexes, RLS policies, and triggers
2. Run migrations in order from `supabase/migrations/`
3. Optionally run `supabase/seed.sql` for sample data

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the storefront and [http://localhost:3000/admin](http://localhost:3000/admin) for the admin panel.

## Database Schema

| Table | Description |
|-------|------------|
| `profiles` | User profiles extending Supabase Auth (name, phone, role) |
| `products` | Product catalog with bilingual fields, pricing, stock, rental support |
| `categories` | Hierarchical categories with Telugu translations |
| `cart_items` | User cart items (synced with Supabase for logged-in users) |
| `wishlist_items` | User wishlisted products |
| `orders` | Orders with status tracking, shipping/billing addresses (JSONB) |
| `order_items` | Line items with denormalized product snapshots |
| `payment_transactions` | Razorpay payment records with signature verification |
| `coupons` | Discount codes (percentage or fixed, with usage limits and expiry) |
| `addresses` | User saved addresses |

All tables have Row-Level Security (RLS) enabled. Users can only access their own data; products, categories, and active coupons are publicly readable.

## Internationalization

- **Framework:** next-intl v4 with App Router integration
- **Locales:** `en` (default, no URL prefix) and `te` (Telugu, `/te/` prefix)
- **Translation Files:** `messages/{en,te}/` with 9 namespaces: common, home, products, constants, about, auth, account, cart, wishlist
- **Routing:** Store components use `Link` and `useRouter` from `@/i18n/routing`; admin uses standard `next/link`
- **Fonts:** Noto Sans Telugu loaded via `--font-telugu` CSS variable for Telugu locale

## Payment Integration

Razorpay is integrated for payment processing:

1. **Order Creation** — Server action creates a Razorpay order and stores a `payment_transactions` record
2. **Client Payment** — Razorpay checkout opens in the browser
3. **Verification** — Payment signature is verified server-side (HMAC-SHA256)
4. **Webhook** — `POST /api/webhooks/razorpay` handles `payment.captured` (updates order status, decrements stock, clears cart) and `payment.failed` events
