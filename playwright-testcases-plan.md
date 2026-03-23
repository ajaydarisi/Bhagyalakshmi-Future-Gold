# Playwright Test Cases Plan — Bhagyalakshmi Future Gold (Offline Mode)

> Comprehensive E2E test plan for the bilingual jewelry e-commerce platform when `STORE_MODE` is set to `OFFLINE`.
> 
> **Note on Offline Mode:** In offline mode, complete e-commerce features (Cart and Checkout) are disabled. The site functions as a digital catalog. Product pages display a "Check Availability" (WhatsApp) button instead of "Add to Cart". Order tracking and user address management are hidden.

---

## 1. Authentication

### 1.1 Login

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | Navigate to `/login`, verify login form renders (email, password fields, submit button, Google sign-in) | High |
| 2 | Login with valid email/password → redirected to home, header shows user name/avatar | High |
| 3 | Login with invalid email → inline validation error shown | High |
| 4 | Login with wrong password → error toast/message displayed | High |
| 5 | Login with empty fields → form shows required-field errors | Medium |
| 6 | Click "Google Sign In" → redirected to Google OAuth flow | Medium |
| 7 | Unauthenticated user visiting protected route (e.g. `/account`) → redirected to login | High |
| 8 | Already-logged-in user visiting `/login` → redirected to home | Medium |

### 1.2 Signup

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | Navigate to `/signup`, verify form renders (name, email, password, confirm password) | High |
| 2 | Signup with valid data → account created, redirected appropriately | High |
| 3 | Signup with already-registered email → error shown | High |
| 4 | Signup with mismatched passwords → validation error | Medium |
| 5 | Signup with weak/short password → validation error | Medium |

### 1.3 Forgot & Reset Password

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | Navigate to `/forgot-password`, submit valid email → success message shown | High |
| 2 | Submit invalid/unregistered email → appropriate error | Medium |
| 3 | Navigate to `/reset-password` with valid token → form to set new password shown | High |
| 4 | Submit new password (matching) → password updated, redirected to login | High |
| 5 | Submit mismatched passwords → validation error | Medium |

### 1.4 Logout

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | Logged-in user clicks logout → session cleared, redirected to home/login | High |
| 2 | After logout, visiting `/account` redirects to login | High |

---

## 2. Home Page

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | Home page loads with hero/banner section visible | High |
| 2 | Featured Products section renders with product cards | High |
| 3 | New Arrivals section renders with product cards | High |
| 4 | Product cards show image, name, price, and are clickable (navigate to PDP) | High |
| 5 | App download banner is visible (when `SHOW_APP_BANNER` env is set) | Low |
| 6 | Page is responsive — layout adapts on mobile viewport | Medium |

---

## 3. Products

### 3.1 Product Listing Page (PLP)

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | Navigate to `/products` → product grid renders with cards | High |
| 2 | Each product card shows image, name, price, and discount price (if any) | High |
| 3 | Product cards DO NOT show "Sold Out" overlays regardless of stock (offline behavior) | High |
| 4 | Filter by category → products update to show only matching items | High |
| 5 | Filter by price range → products update correctly | Medium |
| 6 | Sort by price (low-high / high-low) → order changes | Medium |
| 7 | Sort by newest → order changes | Medium |
| 8 | Pagination / infinite scroll loads more products | Medium |
| 9 | Mobile filter sheet opens and functions correctly | Medium |
| 10 | Search by product name → matching results shown | High |
| 11 | No results state shows appropriate empty message | Medium |
| 12 | Product card click navigates to product detail page | High |

### 3.2 Product Detail Page (PDP)

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | Navigate to `/products/[slug]` → product detail renders (images, name, price, description) | High |
| 2 | Image gallery shows all product images; clicking thumbnails switches main image | Medium |
| 3 | Image lightbox opens on click and can be closed | Low |
| 4 | **Offline Mode**: Verify "Check Availability" (WhatsApp) button is rendered instead of "Add to Cart" | High |
| 5 | **Offline Mode**: Verify clicking "Check Availability" opens a WhatsApp URL with proper message formatting | High |
| 6 | **Offline Mode**: Verify there is NO stock availability text ("In Stock" / "Out of Stock") shown | High |
| 7 | "Add to Wishlist" button adds item to wishlist (heart icon toggles) | High |
| 8 | Breadcrumbs navigate correctly | Low |
| 9 | Price display shows discount price and original price when applicable | Medium |
| 10 | Product detail content renders bilingual name/description based on locale | Medium |
| 11 | If rental product, rental pricing details and maximum duration are shown | Medium |

---

## 4. Wishlist

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | Navigate to `/wishlist` → shows list of wishlisted products | High |
| 2 | Remove item from wishlist → item removed from list | High |
| 3 | Wishlist heart icon on product cards toggles correctly | Medium |
| 4 | Unauthenticated user clicking wishlist → prompted to login | Medium |
| 5 | Empty wishlist shows appropriate message | Medium |
| 6 | **Offline Mode**: Ensure "Add to Cart" is NOT visible on the wishlist page | High |

---

## 5. Account

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | Navigate to `/account` → profile info displayed (name, email, avatar) | High |
| 2 | Edit profile (name, phone) → changes saved, success toast | Medium |
| 3 | Account sidebar navigation works | Medium |
| 4 | **Offline Mode**: Verify "My Orders" tab/link is NOT visible in the sidebar or menu | High |
| 5 | **Offline Mode**: Verify "Addresses" tab/link is NOT visible in the sidebar or menu | High |

---

## 6. Search

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | Navigate to `/search` or use header search → search input shown | High |
| 2 | Type a query → matching products displayed | High |
| 3 | Search with no results → empty state message | Medium |
| 4 | Click a search result → navigates to PDP | High |
| 5 | Mobile product search works (sheet/dialog opens on tap) | Medium |

---

## 7. Internationalization (i18n)

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | Default locale (`/en`) loads with English content | High |
| 2 | Navigate to `/te/…` → Telugu content and Noto Sans Telugu font loaded | High |
| 3 | Language switcher toggles between English ↔ Telugu | High |
| 4 | Product names/descriptions render in the correct locale | Medium |
| 5 | All navigation labels, buttons, footer text change per locale | Medium |
| 6 | URL prefix updates correctly (no prefix for `en`, `/te/` for Telugu) | Medium |

---

## 8. Layout & Navigation

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | Header renders logo, nav links, wishlist, and user menu | High |
| 2 | **Offline Mode**: Verify Cart icon/link is NOT present in the header | High |
| 3 | **Offline Mode**: Verify Cart icon/link is NOT present in the mobile bottom navigation | High |
| 4 | Footer renders with links (about, privacy, T&C, social) | Medium |
| 5 | **Offline Mode**: Verify "Track Order", "Shopping Bag", and "Addresses" are NOT present in the Footer links | High |
| 6 | Mobile bottom-nav renders with correct icons and active state | Medium |
| 7 | Mobile hamburger menu opens/closes and includes all navigation links | Medium |
| 8 | Dark mode toggle switches theme; styles persist on refresh | Medium |

---

## 9. Static / Legal Pages

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | `/about` page renders with content | Low |
| 2 | `/privacy-policy` page renders | Low |
| 3 | `/terms-and-conditions` page renders | Low |
| 4 | `/feedback` page renders feedback form; form validates and submits | Medium |

---

## 10. Admin Panel (Remains functional in Offline Mode)

### 10.1 Admin Access & Dashboard

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | Non-admin user visiting `/admin` → denied access / redirected | High |
| 2 | Admin user visits `/admin` → dashboard renders with stats cards and revenue chart | High |
| 3 | Stats cards show correct metrics | Medium |

### 10.2 Admin Products

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | `/admin/products` → products data table loads with columns | High |
| 2 | Search/filter products in admin table | Medium |
| 3 | "Add Product" → product form opens | High |
| 4 | Create product with valid data → product saved | High |
| 5 | Edit existing product → form pre-fills, modifications save | High |
| 6 | Delete product → confirmation dialog | High |

### 10.3 Admin Orders

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | `/admin/orders` → orders table loads | High |
| 2 | Update order status (for historic orders if any) | High |

### 10.4 Admin Categories & Coupons

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | `/admin/categories` → categories manager loads, can create/edit/delete | High |
| 2 | `/admin/coupons` → coupons manager loads, can create/edit/delete | High |

### 10.5 Admin Users & Notifications

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | `/admin/users` → users table loads | High |
| 2 | `/admin/notifications` → can compose and send push notifications | Medium |

---

## 11. Edge Cases & Miscellaneous

| # | Test Case | Priority |
|---|-----------|----------|
| 1 | Visit a non-existent route → custom 404 page shown | Medium |
| 2 | Server error triggers error boundary / error page | Medium |
| 3 | **Offline Mode Defense**: User manually navigating to `/cart` or `/checkout` should encounter a 404 or redirect (if implemented) | High |
| 4 | Visit a product with an invalid slug → 404 | Medium |

---

## Test Environment Notes

- **Environment & Database**: Must use a separate `.env.test` environment and isolated test database (e.g. `bfg-test-db` on Supabase) to avoid affecting production data.
- **Store Mode**: Next.js must be running with `NEXT_PUBLIC_STORE_MODE=OFFLINE` for this specific suite.
- **Base URL**: `http://localhost:3000` (or the configured test origin)
- **Auth test users**: Need a seeded test customer and test admin account in the test database.
- **Test data**: Requires seeding the test database with dummy products, categories, and tags before each run.
- **Viewports**: Mobile (375×667), Tablet (768×1024), Desktop (1280×800)
- **Locales**: Test English (default, `/`) and Telugu (`/te/`)

---

## Summary

| Area | Test Count |
|------|-----------|
| Authentication | 20 |
| Home Page | 6 |
| Products (PLP + PDP) | 23 |
| Wishlist | 6 |
| Account | 5 |
| Search | 5 |
| i18n | 6 |
| Layout & Navigation | 8 |
| Static / Legal Pages | 4 |
| Admin Panel | 14 |
| Edge Cases | 4 |
| **Total** | **~101** |
