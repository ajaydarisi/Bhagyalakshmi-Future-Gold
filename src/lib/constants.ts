export const STORE_MODE = (process.env.NEXT_PUBLIC_STORE_MODE || "ONLINE").toUpperCase() as "ONLINE" | "OFFLINE";
export const IS_ONLINE = STORE_MODE === "ONLINE";

export const APP_NAME = "Bhagyalakshmi Future Gold";
export const APP_DESCRIPTION =
  "Shop quality-checked fashion jewellery at Bhagyalakshmi Future Gold, Chirala. Visit our store or explore curated collections of necklaces, earrings, bracelets, rings, and jewellery sets online. Free shipping on orders above \u20B9999.";

export const CATEGORIES = [
  { name: "Gold Jewelry", slug: "gold-jewelry" },
  { name: "Polish / Finish Types", slug: "polish-finish-types" },
  { name: "Metal Types", slug: "metal-types" },
  { name: "Bangles & Bracelets", slug: "bangles-bracelets" },
  { name: "Neck Jewelry", slug: "neck-jewelry" },
  { name: "Dance & Traditional Ornaments", slug: "dance-traditional-ornaments" },
  { name: "Leg & Hair Accessories", slug: "leg-hair-accessories" },
  { name: "Marriage Rental Sets", slug: "marriage-rental-sets" },
] as const;

export const PRODUCT_TYPES = [
  { value: "all", label: "All" },
  { value: "sale", label: "For Sale" },
  { value: "rental", label: "For Rent" },
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
  "Panchaloha",
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
  about: "/about",
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
} as const;

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
  email: "darisilakshmi3@gmail.com",
  whatsapp: "8328031546",
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
