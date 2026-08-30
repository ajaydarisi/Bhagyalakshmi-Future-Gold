export const STORE_MODE = (process.env.NEXT_PUBLIC_STORE_MODE || "ONLINE").toUpperCase() as "ONLINE" | "OFFLINE";
export const IS_ONLINE = STORE_MODE === "ONLINE";

export const APP_NAME = "Bhagyalakshmi Future Gold";
export const APP_DESCRIPTION =
  "Shop quality-checked fashion jewellery at Bhagyalakshmi Future Gold, Chirala. Visit our store or explore curated collections of necklaces, earrings, bracelets, rings, and jewellery sets online. Free shipping on orders above \u20B9999.";

export const PRODUCT_TYPES = [
  { value: "all", label: "All" },
  { value: "sale", label: "For Sale" },
  { value: "rental", label: "For Rent" },
] as const;

export const MATERIALS = [
  "Gold Plated",
  "Panchaloha",
  "Antique",
  "Nakshi",
  "GJ Polish",
  "CZ",
  "Un Cut Stone",
] as const;

export const PRODUCT_TAGS = [
  "Trending",
  "New",
  "Best Seller",
  "Sale",
  "Limited Edition",
] as const;

export const ORDER_STATUSES = [
  {
    value: "pending",
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800",
  },
  { value: "paid", label: "Paid", color: "bg-blue-100 text-blue-800" },
  {
    value: "processing",
    label: "Processing",
    color: "bg-indigo-100 text-indigo-800",
  },
  {
    value: "shipped",
    label: "Shipped",
    color: "bg-purple-100 text-purple-800",
  },
  {
    value: "delivered",
    label: "Delivered",
    color: "bg-green-100 text-green-800",
  },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800" },
  { value: "refunded", label: "Refunded", color: "bg-gray-100 text-gray-800" },
] as const;

// Allowed order status transitions. Guards the admin status updater so an order
// can't jump to an unrelated state (e.g. delivered on an unpaid order, which
// would auto-activate a rental) or move backward and re-fire push notifications.
// cancelled/refunded are terminal — no outgoing transitions — which also means
// a paid order enters a stock-releasing state exactly once, so the cancel/refund
// stock restore can run without extra idempotency tracking.
export const ORDER_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ["paid", "cancelled"],
  paid: ["processing", "shipped", "delivered", "cancelled", "refunded"],
  processing: ["shipped", "delivered", "cancelled", "refunded"],
  shipped: ["delivered", "cancelled", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

// Statuses in which sale stock has already been decremented (see verifyPayment /
// webhook). Transitioning out of one of these into cancelled/refunded restores it.
export const STOCK_HOLDING_STATUSES = [
  "paid",
  "processing",
  "shipped",
  "delivered",
] as const;

// Rental lifecycle for non-sale orders. "overdue" is derived (active + past
// latest rental_end), never stored in the DB.
export const RENTAL_STATUSES = [
  { value: "booked", label: "Booked", color: "bg-blue-100 text-blue-800" },
  { value: "active", label: "Active", color: "bg-green-100 text-green-800" },
  { value: "returned", label: "Returned", color: "bg-gray-100 text-gray-800" },
  { value: "overdue", label: "Overdue", color: "bg-red-100 text-red-800" },
] as const;

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low → High" },
  { value: "price-desc", label: "Price: High → Low" },
  { value: "name-asc", label: "Name: A → Z" },
  { value: "discount", label: "Discount" },
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
  about: "/about",
  visit: "/visit",
  termsAndConditions: "/terms-and-conditions",
  privacyPolicy: "/privacy-policy",
  admin: "/admin",
  adminProducts: "/admin/products",
  adminProductNew: "/admin/products/new",
  adminProductEdit: (id: string) => `/admin/products/${id}/edit`,
  adminOrders: "/admin/orders",
  adminOrder: (id: string) => `/admin/orders/${id}`,
  adminCategories: "/admin/categories",
  adminUsers: "/admin/users",
  adminCoupons: "/admin/coupons",
  adminNotifications: "/admin/notifications",
} as const;

// Routes that only make sense when the store is in ONLINE mode. Single source
// of truth shared by the middleware route guard and the storefront nav gating,
// so adding an online-only route blocks it in both places at once.
// Paths are locale-stripped (no /te prefix) to match middleware's stripLocale().
export const ONLINE_ONLY_ROUTES = [
  ROUTES.cart,
  ROUTES.checkout,
  ROUTES.accountOrders,
  ROUTES.accountAddresses,
] as const;

export function isOnlineOnlyRoute(strippedPath: string): boolean {
  return ONLINE_ONLY_ROUTES.some(
    (route) => strippedPath === route || strippedPath.startsWith(route + "/")
  );
}

export const NOTIFICATION_TYPES = [
  { value: "custom", label: "Custom Message" },
  { value: "promotion", label: "Promotion" },
] as const;

export const NOTIFICATION_TARGETS = [
  { value: "all", label: "All Users" },
  { value: "user", label: "Specific User" },
  { value: "topic", label: "Topic" },
] as const;

export const BUSINESS_INFO = {
  name: "Bhagyalakshmi Future Gold",
  proprietor: {
    name: "Darisi Bhagyalakshmi",
    title: "Proprietor",
  },
  address: {
    street: "Opposite SBI Bank on the right",
    city: "Chirala",
    district: "Bapatla",
    state: "Andhra Pradesh",
    pincode: "523155",
    country: "India",
  },
  phone: "+91 9290011275",
  email: "contact@bfg.darisi.in",
  whatsapp: "9290011275",
  hours: {
    weekdays: "10:00 AM – 9:00 PM",
    sunday: "10:00 AM – 2:00 PM",
  },
  map: {
    embedUrl:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3838.6000747384314!2d80.35052687603185!3d15.825027884819738!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a4a443d61be7dc3%3A0x95f4d1ce87eab9e6!2sBhagyalakshmi%20future%20gold!5e0!3m2!1sen!2sin!4v1771599857284!5m2!1sen!2sin",
    linkUrl:
      "https://www.google.com/maps/dir//Bhagyalakshmi+future+gold,+Muntha+vari+Centre,+Chirala,+Andhra+Pradesh+523155/@12.9564672,77.6208384,13z/data=!4m8!4m7!1m0!1m5!1m1!1s0x3a4a443d61be7dc3:0x95f4d1ce87eab9e6!2m2!1d80.3531021!2d15.8250276?hl=en-IN&entry=ttu&g_ep=EgoyMDI2MDIxNy4wIKXMDSoASAFQAw%3D%3D", // TODO: Google Maps "Get Directions" link
  },
} as const;

export const BRAND_STORY = {
  tagline: "Quality-Checked Fashion Jewellery from the Heart of Andhra Pradesh",
  short:
    "Bhagyalakshmi Future Gold brings you quality-checked fashion jewellery. Based in Chirala, we personally inspect every piece before it reaches you.",
  mission:
    "To make beautiful, quality-assured fashion jewellery accessible to everyone — whether you visit our Chirala store or shop online.",
  qualityProcess:
    "Every piece of jewellery passes through our hands before it reaches yours. We personally quality-check each item for finish, durability, and design accuracy.",
  warranty:
    "We provide warranty on specific items. Ask us about warranty coverage when you purchase — in-store or online.",
} as const;

export const SHOP_IMAGES = {
  storefront: "/images/shop/storefront.jpeg",
  interior: "/images/shop/interior.jpeg",
  display: "/images/shop/display.jpeg",
} as const;

export const SHIPPING_COST = 49;
export const FREE_SHIPPING_THRESHOLD = 999;
export const CURRENCY = "INR";
export const CURRENCY_SYMBOL = "₹";
