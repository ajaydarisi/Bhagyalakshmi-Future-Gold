export const APP_NAME = "BFG Jewelry";
export const APP_DESCRIPTION =
  "Discover exquisite fashion jewelry - necklaces, earrings, bracelets, rings, and jewelry sets.";

export const CATEGORIES = [
  { name: "Necklaces", slug: "necklaces" },
  { name: "Earrings", slug: "earrings" },
  { name: "Bracelets", slug: "bracelets" },
  { name: "Rings", slug: "rings" },
  { name: "Jewelry Sets", slug: "jewelry-sets" },
] as const;

export const MATERIALS = [
  "Gold Plated",
  "Silver",
  "Rose Gold",
  "Beads",
  "Pearl",
  "Crystal",
  "Stainless Steel",
  "Brass",
] as const;

export const PRODUCT_TAGS = [
  "Trending",
  "New",
  "Best Seller",
  "Sale",
  "Limited Edition",
] as const;

export const ORDER_STATUSES = [
  { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: "paid", label: "Paid", color: "bg-blue-100 text-blue-800" },
  { value: "processing", label: "Processing", color: "bg-indigo-100 text-indigo-800" },
  { value: "shipped", label: "Shipped", color: "bg-purple-100 text-purple-800" },
  { value: "delivered", label: "Delivered", color: "bg-green-100 text-green-800" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800" },
  { value: "refunded", label: "Refunded", color: "bg-gray-100 text-gray-800" },
] as const;

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low → High" },
  { value: "price-desc", label: "Price: High → Low" },
  { value: "name-asc", label: "Name: A → Z" },
] as const;

export const PRODUCTS_PER_PAGE = 12;

export const ROUTES = {
  home: "/",
  products: "/products",
  product: (slug: string) => `/products/${slug}`,
  search: "/search",
  cart: "/cart",
  checkout: "/checkout",
  checkoutConfirmation: "/checkout/confirmation",
  wishlist: "/wishlist",
  account: "/account",
  accountOrders: "/account/orders",
  accountOrder: (id: string) => `/account/orders/${id}`,
  accountAddresses: "/account/addresses",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  admin: "/admin",
  adminProducts: "/admin/products",
  adminProductNew: "/admin/products/new",
  adminProductEdit: (id: string) => `/admin/products/${id}/edit`,
  adminOrders: "/admin/orders",
  adminOrder: (id: string) => `/admin/orders/${id}`,
  adminCategories: "/admin/categories",
  adminUsers: "/admin/users",
  adminCoupons: "/admin/coupons",
} as const;

export const SHIPPING_COST = 49;
export const FREE_SHIPPING_THRESHOLD = 999;
export const CURRENCY = "INR";
export const CURRENCY_SYMBOL = "₹";
