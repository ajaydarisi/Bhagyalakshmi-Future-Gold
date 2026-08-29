import { MATERIALS, PRODUCT_TAGS, ROUTES, SORT_OPTIONS, STORE_MODE } from "@/lib/constants";
import type {
  AssistantNavigation,
  AssistantNavigationDestination,
  AssistantNavigationKind,
} from "@/types/search";
import { z } from "zod";

/**
 * The customer routes the assistant may describe, resolve, or expose to
 * first-party and external agents. This is deliberately separate from the
 * Next route tree: not every application route is safe for an assistant to
 * navigate to (notably admin and OAuth bridge routes).
 */
export const ASSISTANT_ROUTE_IDS = [
  "home",
  "products",
  "search",
  "cart",
  "checkout",
  "wishlist",
  "account",
  "orders",
  "addresses",
  "about",
  "visit",
  "terms",
  "privacy",
  "login",
  "signup",
  "forgot_password",
  "product_detail",
  "order_detail",
  "checkout_confirmation",
] as const;

export type AssistantRouteId = (typeof ASSISTANT_ROUTE_IDS)[number];
export type AssistantRouteLocale = "en" | "te";
export type AssistantStoreMode = "ONLINE" | "OFFLINE";
export type AssistantRouteAuthRequirement = "public" | "optional" | "required";
export type AssistantRouteEntityResolution = "none" | "product" | "owned_order";

export type AssistantRouteCopy = {
  description: string;
  examples: readonly string[];
};

const MAX_NAVIGATION_TEXT_LENGTH = 160;
const MAX_NAVIGATION_PRICE = 10_000_000;
const MAX_NAVIGATION_PAGE = 10_000;
const PRODUCT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ORDER_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The only document-section fragments that can cross the assistant transport
 * boundary. Keep these route-owned rather than trusting retrieval metadata or
 * model output. Values mirror the actual section IDs on the public pages.
 */
export const ASSISTANT_ROUTE_ALLOWED_ANCHORS = {
  about: [
    "store-info",
    "our-story",
    "quality-promise",
    "faq",
    "faq-q1",
    "faq-q2",
    "faq-q3",
    "faq-q4",
    "faq-q5",
    "visit-us",
  ],
  terms: [
    "useOfWebsite",
    "productsAndPricing",
    "ordersAndPayments",
    "shippingAndDelivery",
    "returnsAndExchanges",
    "rentalTerms",
    "intellectualProperty",
    "limitationOfLiability",
    "governingLaw",
    "contact",
  ],
  privacy: [
    "informationWeCollect",
    "howWeUse",
    "googleAuth",
    "paymentInfo",
    "cookies",
    "dataSecurity",
    "thirdParty",
    "dataRetention",
    "childrensPrivacy",
    "yourRights",
    "changes",
    "contact",
  ],
} as const;

const boundedNavigationTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_NAVIGATION_TEXT_LENGTH)
  .refine((value) => !/[\u0000-\u001F\u007F]/.test(value), {
    message: "Text contains control characters",
  });

const noAssistantRouteParamsSchema = z.object({}).strict();

/** Comma-separated list where every entry must be in a closed catalog
 *  vocabulary. Rejects unknown values so a navigation cannot look valid and
 *  then render an empty grid; also rejects empty entries so the value
 *  round-trips serialization byte-for-byte. */
function catalogVocabularyListSchema(vocabulary: readonly string[]) {
  return boundedNavigationTextSchema.refine(
    (value) => {
      const entries = value.split(",");
      return entries.every((entry) => vocabulary.includes(entry));
    },
    { message: "Value is not in the catalog vocabulary" },
  );
}

/** Same shape for the admin-managed category slugs, which are data not enums. */
export function areKnownCategorySlugs(
  value: string,
  knownCategorySlugs: readonly string[],
) {
  return value.split(",").every((slug) => knownCategorySlugs.includes(slug));
}

const productFilterParamsSchema = z
  .object({
    q: boundedNavigationTextSchema.optional(),
    type: z.enum(["sale", "rental", "all"]).optional(),
    minPrice: z.number().int().positive().max(MAX_NAVIGATION_PRICE).optional(),
    maxPrice: z.number().int().positive().max(MAX_NAVIGATION_PRICE).optional(),
    // A syntactically valid but meaningless value round-trips the byte-compare
    // invariant perfectly and then lands the customer on an empty grid, so these
    // are constrained to the real catalog vocabulary rather than free text.
    // All three are comma-separated lists: the products page splits on "," and
    // the deterministic resolver joins multi-selects that way.
    // `category` is admin-managed data, so it is validated against slugs passed
    // in by the caller (see knownCategorySlugs) instead of a compile-time enum.
    category: boundedNavigationTextSchema.optional(),
    material: catalogVocabularyListSchema(MATERIALS).optional(),
    tag: catalogVocabularyListSchema(PRODUCT_TAGS).optional(),
    sort: z.enum(SORT_OPTIONS.map((option) => option.value) as [string, ...string[]]).optional(),
    page: z.number().int().positive().max(MAX_NAVIGATION_PAGE).optional(),
  })
  .strict()
  .refine(
    (params) =>
      !params.minPrice || !params.maxPrice || params.minPrice <= params.maxPrice,
    { message: "minPrice cannot exceed maxPrice" },
  );

const productDetailParamsSchema = z
  .object({
    slug: z.string().regex(PRODUCT_SLUG_PATTERN),
  })
  .strict();

const orderDetailParamsSchema = z
  .object({
    id: z.string().regex(ORDER_UUID_PATTERN),
  })
  .strict();

const checkoutConfirmationParamsSchema = z
  .object({
    orderId: z.string().regex(ORDER_UUID_PATTERN),
  })
  .strict();

const aboutParamsSchema = z
  .object({
    anchor: z.enum(ASSISTANT_ROUTE_ALLOWED_ANCHORS.about).optional(),
  })
  .strict();

const termsParamsSchema = z
  .object({
    anchor: z.enum(ASSISTANT_ROUTE_ALLOWED_ANCHORS.terms).optional(),
  })
  .strict();

const privacyParamsSchema = z
  .object({
    anchor: z.enum(ASSISTANT_ROUTE_ALLOWED_ANCHORS.privacy).optional(),
  })
  .strict();

/** Exported separately so route consumers can bind parameters without URLs. */
export const ASSISTANT_ROUTE_PARAM_SCHEMAS = {
  home: noAssistantRouteParamsSchema,
  products: productFilterParamsSchema,
  search: noAssistantRouteParamsSchema,
  cart: noAssistantRouteParamsSchema,
  checkout: noAssistantRouteParamsSchema,
  wishlist: noAssistantRouteParamsSchema,
  account: noAssistantRouteParamsSchema,
  orders: noAssistantRouteParamsSchema,
  addresses: noAssistantRouteParamsSchema,
  about: aboutParamsSchema,
  visit: noAssistantRouteParamsSchema,
  terms: termsParamsSchema,
  privacy: privacyParamsSchema,
  login: noAssistantRouteParamsSchema,
  signup: noAssistantRouteParamsSchema,
  forgot_password: noAssistantRouteParamsSchema,
  product_detail: productDetailParamsSchema,
  order_detail: orderDetailParamsSchema,
  checkout_confirmation: checkoutConfirmationParamsSchema,
} as const;

export type AssistantRouteParamsById = {
  [RouteId in AssistantRouteId]: z.output<
    (typeof ASSISTANT_ROUTE_PARAM_SCHEMAS)[RouteId]
  >;
};

export type AssistantRouteManifestEntry<RouteId extends AssistantRouteId = AssistantRouteId> = {
  id: RouteId;
  kind: AssistantNavigationKind;
  destination: AssistantNavigationDestination;
  /** Human-readable pattern; never use this as a URL template at runtime. */
  pathPattern: string;
  auth: AssistantRouteAuthRequirement;
  storeModes: readonly AssistantStoreMode[];
  /** Dynamic entities are resolved by the server, never guessed by the LLM. */
  entityResolution: AssistantRouteEntityResolution;
  /** Whether Gemini may choose this route directly in the Phase 1 fallback. */
  llmEnabled: boolean;
  copy: Record<AssistantRouteLocale, AssistantRouteCopy>;
  paramsSchema: (typeof ASSISTANT_ROUTE_PARAM_SCHEMAS)[RouteId];
  serialize: (params: AssistantRouteParamsById[RouteId]) => AssistantNavigation;
};

function defineRoute<RouteId extends AssistantRouteId>(
  entry: AssistantRouteManifestEntry<RouteId>,
) {
  return entry;
}

function staticPageNavigation(
  destination: Extract<AssistantNavigationDestination, "home" | "search" | "cart" | "checkout" | "wishlist" | "account" | "orders" | "addresses" | "about" | "visit" | "terms" | "privacy" | "login" | "signup" | "forgot_password">,
  href: string,
): AssistantNavigation {
  return { kind: "page", destination, href };
}

function productFiltersNavigation(
  params: AssistantRouteParamsById["products"],
): AssistantNavigation {
  const searchParams = new URLSearchParams();

  if (params.type) searchParams.set("type", params.type);
  if (params.minPrice) searchParams.set("minPrice", String(params.minPrice));
  if (params.maxPrice) searchParams.set("maxPrice", String(params.maxPrice));
  if (params.tag) searchParams.set("tag", params.tag);
  if (params.material) searchParams.set("material", params.material);
  if (params.category) searchParams.set("category", params.category);
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.page) searchParams.set("page", String(params.page));
  if (params.q) searchParams.set("q", params.q);

  const suffix = searchParams.toString();
  return {
    kind: "product_filters",
    destination: "products",
    href: suffix ? `${ROUTES.products}?${suffix}` : ROUTES.products,
  };
}

/**
 * The canonical manifest. `llmEnabled` is intentionally false for routes
 * whose parameters identify private or catalog-backed entities: those keep
 * using the existing server-side dynamic resolver.
 */
export const ASSISTANT_ROUTE_MANIFEST = [
  defineRoute<"home">({
    id: "home",
    kind: "page",
    destination: "home",
    pathPattern: "/",
    auth: "public",
    storeModes: ["ONLINE", "OFFLINE"],
    entityResolution: "none",
    llmEnabled: true,
    copy: {
      en: { description: "Store home page", examples: ["Go home", "Open the home page"] },
      te: { description: "స్టోర్ హోమ్ పేజీ", examples: ["హోమ్ పేజీకి వెళ్లండి", "హోమ్ తెరవండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.home,
    serialize: () => staticPageNavigation("home", ROUTES.home),
  }),
  defineRoute<"products">({
    id: "products",
    kind: "product_filters",
    destination: "products",
    pathPattern: "/products{?q,type,minPrice,maxPrice,category,material,tag,sort,page}",
    auth: "public",
    storeModes: ["ONLINE", "OFFLINE"],
    entityResolution: "none",
    llmEnabled: true,
    copy: {
      en: {
        description: "Browse the jewellery catalog, optionally with safe filters",
        examples: ["Show antique earrings", "Browse rental sets under 3000"],
      },
      te: {
        description: "సురక్షిత ఫిల్టర్లతో జ్యువెలరీ కాటలాగ్‌ను చూడండి",
        examples: ["ఆంటిక్ ఇయరింగ్స్ చూపించండి", "3000 లోపు అద్దె సెట్లు చూపించండి"],
      },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.products,
    serialize: productFiltersNavigation,
  }),
  defineRoute<"search">({
    id: "search",
    kind: "page",
    destination: "search",
    pathPattern: "/search",
    auth: "public",
    storeModes: ["ONLINE", "OFFLINE"],
    entityResolution: "none",
    llmEnabled: true,
    copy: {
      en: { description: "Product search page", examples: ["Open product search"] },
      te: { description: "ఉత్పత్తి సెర్చ్ పేజీ", examples: ["ఉత్పత్తి సెర్చ్ తెరవండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.search,
    serialize: () => staticPageNavigation("search", ROUTES.search),
  }),
  defineRoute<"cart">({
    id: "cart",
    kind: "page",
    destination: "cart",
    pathPattern: "/cart",
    auth: "optional",
    storeModes: ["ONLINE"],
    entityResolution: "none",
    llmEnabled: true,
    copy: {
      en: { description: "Shopping cart", examples: ["Open my cart", "Take me to my bag"] },
      te: { description: "షాపింగ్ కార్ట్", examples: ["నా కార్ట్ తెరవండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.cart,
    serialize: () => staticPageNavigation("cart", ROUTES.cart),
  }),
  defineRoute<"checkout">({
    id: "checkout",
    kind: "page",
    destination: "checkout",
    pathPattern: "/checkout",
    auth: "optional",
    storeModes: ["ONLINE"],
    entityResolution: "none",
    llmEnabled: true,
    copy: {
      en: { description: "Secure checkout", examples: ["Go to checkout", "Open payment page"] },
      te: { description: "సురక్షిత చెక్అవుట్", examples: ["చెక్అవుట్‌కు వెళ్లండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.checkout,
    serialize: () => staticPageNavigation("checkout", ROUTES.checkout),
  }),
  defineRoute<"wishlist">({
    id: "wishlist",
    kind: "page",
    destination: "wishlist",
    pathPattern: "/wishlist",
    auth: "required",
    storeModes: ["ONLINE", "OFFLINE"],
    entityResolution: "none",
    llmEnabled: true,
    copy: {
      en: { description: "Saved wishlist", examples: ["Open my wishlist"] },
      te: { description: "సేవ్ చేసిన విష్‌లిస్ట్", examples: ["నా విష్‌లిస్ట్ తెరవండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.wishlist,
    serialize: () => staticPageNavigation("wishlist", ROUTES.wishlist),
  }),
  defineRoute<"account">({
    id: "account",
    kind: "page",
    destination: "account",
    pathPattern: "/account",
    auth: "required",
    storeModes: ["ONLINE", "OFFLINE"],
    entityResolution: "none",
    llmEnabled: true,
    copy: {
      en: { description: "Customer account", examples: ["Open my account", "Go to my profile"] },
      te: { description: "కస్టమర్ ఖాతా", examples: ["నా ఖాతా తెరవండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.account,
    serialize: () => staticPageNavigation("account", ROUTES.account),
  }),
  defineRoute<"orders">({
    id: "orders",
    kind: "page",
    destination: "orders",
    pathPattern: "/account/orders",
    auth: "required",
    storeModes: ["ONLINE"],
    entityResolution: "none",
    llmEnabled: true,
    copy: {
      en: { description: "Customer order history", examples: ["Open my orders"] },
      te: { description: "కస్టమర్ ఆర్డర్ చరిత్ర", examples: ["నా ఆర్డర్లు తెరవండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.orders,
    serialize: () => staticPageNavigation("orders", ROUTES.accountOrders),
  }),
  defineRoute<"addresses">({
    id: "addresses",
    kind: "page",
    destination: "addresses",
    pathPattern: "/account/addresses",
    auth: "required",
    storeModes: ["ONLINE"],
    entityResolution: "none",
    llmEnabled: true,
    copy: {
      en: { description: "Saved delivery addresses", examples: ["Open my saved addresses"] },
      te: { description: "సేవ్ చేసిన డెలివరీ చిరునామాలు", examples: ["నా సేవ్ చేసిన చిరునామాలు తెరవండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.addresses,
    serialize: () => staticPageNavigation("addresses", ROUTES.accountAddresses),
  }),
  defineRoute<"about">({
    id: "about",
    kind: "page",
    destination: "about",
    pathPattern: "/about{#anchor}",
    auth: "public",
    storeModes: ["ONLINE", "OFFLINE"],
    entityResolution: "none",
    llmEnabled: true,
    copy: {
      en: { description: "About the jewellery store", examples: ["Open the about page"] },
      te: { description: "జ్యువెలరీ స్టోర్ గురించి", examples: ["మా గురించి పేజీ తెరవండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.about,
    serialize: (params) =>
      staticPageNavigation(
        "about",
        params.anchor ? `${ROUTES.about}#${params.anchor}` : ROUTES.about,
      ),
  }),
  defineRoute<"visit">({
    id: "visit",
    kind: "page",
    destination: "visit",
    pathPattern: "/visit",
    auth: "public",
    storeModes: ["ONLINE", "OFFLINE"],
    entityResolution: "none",
    llmEnabled: true,
    copy: {
      en: { description: "Store location and visit information", examples: ["Open store directions"] },
      te: { description: "స్టోర్ స్థానం మరియు సందర్శన సమాచారం", examples: ["స్టోర్ దారి తెరవండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.visit,
    serialize: () => staticPageNavigation("visit", ROUTES.visit),
  }),
  defineRoute<"terms">({
    id: "terms",
    kind: "page",
    destination: "terms",
    pathPattern: "/terms-and-conditions{#anchor}",
    auth: "public",
    storeModes: ["ONLINE", "OFFLINE"],
    entityResolution: "none",
    llmEnabled: true,
    copy: {
      en: { description: "Terms and conditions", examples: ["Open terms and conditions"] },
      te: { description: "నిబంధనలు మరియు షరతులు", examples: ["నిబంధనలు తెరవండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.terms,
    serialize: (params) =>
      staticPageNavigation(
        "terms",
        params.anchor
          ? `${ROUTES.termsAndConditions}#${params.anchor}`
          : ROUTES.termsAndConditions,
      ),
  }),
  defineRoute<"privacy">({
    id: "privacy",
    kind: "page",
    destination: "privacy",
    pathPattern: "/privacy-policy{#anchor}",
    auth: "public",
    storeModes: ["ONLINE", "OFFLINE"],
    entityResolution: "none",
    llmEnabled: true,
    copy: {
      en: { description: "Privacy policy", examples: ["Open the privacy policy"] },
      te: { description: "గోప్యతా విధానం", examples: ["ప్రైవసీ పాలసీ తెరవండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.privacy,
    serialize: (params) =>
      staticPageNavigation(
        "privacy",
        params.anchor
          ? `${ROUTES.privacyPolicy}#${params.anchor}`
          : ROUTES.privacyPolicy,
      ),
  }),
  defineRoute<"login">({
    id: "login",
    kind: "page",
    destination: "login",
    pathPattern: "/login",
    auth: "public",
    storeModes: ["ONLINE", "OFFLINE"],
    entityResolution: "none",
    llmEnabled: true,
    copy: {
      en: { description: "Customer sign-in", examples: ["Open login"] },
      te: { description: "కస్టమర్ సైన్-ఇన్", examples: ["లాగిన్ తెరవండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.login,
    serialize: () => staticPageNavigation("login", ROUTES.login),
  }),
  defineRoute<"signup">({
    id: "signup",
    kind: "page",
    destination: "signup",
    pathPattern: "/signup",
    auth: "public",
    storeModes: ["ONLINE", "OFFLINE"],
    entityResolution: "none",
    llmEnabled: true,
    copy: {
      en: { description: "Create a customer account", examples: ["Open sign up"] },
      te: { description: "కస్టమర్ ఖాతా సృష్టించండి", examples: ["సైన్ అప్ తెరవండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.signup,
    serialize: () => staticPageNavigation("signup", ROUTES.signup),
  }),
  defineRoute<"forgot_password">({
    id: "forgot_password",
    kind: "page",
    destination: "forgot_password",
    pathPattern: "/forgot-password",
    auth: "public",
    storeModes: ["ONLINE", "OFFLINE"],
    entityResolution: "none",
    llmEnabled: true,
    copy: {
      en: { description: "Password recovery", examples: ["Reset my password"] },
      te: { description: "పాస్‌వర్డ్ రికవరీ", examples: ["నా పాస్‌వర్డ్ రీసెట్ తెరవండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.forgot_password,
    serialize: () => staticPageNavigation("forgot_password", ROUTES.forgotPassword),
  }),
  defineRoute<"product_detail">({
    id: "product_detail",
    kind: "product_detail",
    destination: "product_detail",
    pathPattern: "/products/:slug",
    auth: "public",
    storeModes: ["ONLINE", "OFFLINE"],
    entityResolution: "product",
    llmEnabled: false,
    copy: {
      en: { description: "A specific catalog product", examples: ["Open Lotus Necklace"] },
      te: { description: "నిర్దిష్ట కాటలాగ్ ఉత్పత్తి", examples: ["లోటస్ నెక్లెస్ తెరవండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.product_detail,
    serialize: (params) => ({
      kind: "product_detail",
      destination: "product_detail",
      href: ROUTES.product(params.slug),
    }),
  }),
  defineRoute<"order_detail">({
    id: "order_detail",
    kind: "order_detail",
    destination: "order_detail",
    pathPattern: "/account/orders/:id",
    auth: "required",
    storeModes: ["ONLINE"],
    entityResolution: "owned_order",
    llmEnabled: false,
    copy: {
      en: { description: "A customer-owned order", examples: ["Open my latest order"] },
      te: { description: "కస్టమర్‌కు చెందిన ఆర్డర్", examples: ["నా తాజా ఆర్డర్ తెరవండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.order_detail,
    serialize: (params) => ({
      kind: "order_detail",
      destination: "order_detail",
      href: ROUTES.accountOrder(params.id),
    }),
  }),
  defineRoute<"checkout_confirmation">({
    id: "checkout_confirmation",
    kind: "checkout_confirmation",
    destination: "checkout_confirmation",
    pathPattern: "/checkout/confirmation?order_id=:orderId",
    auth: "required",
    storeModes: ["ONLINE"],
    entityResolution: "owned_order",
    llmEnabled: false,
    copy: {
      en: { description: "A customer-owned order confirmation", examples: ["Open my order receipt"] },
      te: { description: "కస్టమర్‌కు చెందిన ఆర్డర్ నిర్ధారణ", examples: ["నా ఆర్డర్ రసీదు తెరవండి"] },
    },
    paramsSchema: ASSISTANT_ROUTE_PARAM_SCHEMAS.checkout_confirmation,
    serialize: (params) => ({
      kind: "checkout_confirmation",
      destination: "checkout_confirmation",
      href: `${ROUTES.checkoutConfirmation}?order_id=${encodeURIComponent(params.orderId)}`,
    }),
  }),
] as const;

export type AssistantRouteManifestOptions = {
  storeMode?: AssistantStoreMode;
  llmOnly?: boolean;
  includeEntityRoutes?: boolean;
};

export type AssistantRouteSerializationOptions = {
  storeMode?: AssistantStoreMode;
  /** Live `categories.slug` values. When supplied, a product-filter navigation
   *  naming an unknown category is rejected instead of navigating to an empty
   *  page. Omitted on the client, where the server already validated it and the
   *  byte-compare guarantees the client is looking at the server's own value. */
  knownCategorySlugs?: readonly string[];
};

function resolveStoreMode(storeMode?: AssistantStoreMode): AssistantStoreMode {
  return storeMode ?? (STORE_MODE === "OFFLINE" ? "OFFLINE" : "ONLINE");
}

export function isAssistantRouteAvailable(
  route: { storeModes: readonly AssistantStoreMode[] },
  storeMode?: AssistantStoreMode,
) {
  return route.storeModes.includes(resolveStoreMode(storeMode));
}

export function getAssistantRouteManifest(
  options: AssistantRouteManifestOptions = {},
) {
  return ASSISTANT_ROUTE_MANIFEST.filter((route) => {
    if (!isAssistantRouteAvailable(route, options.storeMode)) return false;
    if (options.llmOnly && !route.llmEnabled) return false;
    if (options.includeEntityRoutes === false && route.entityResolution !== "none") {
      return false;
    }
    return true;
  });
}

export function getAssistantRouteManifestEntry<RouteId extends AssistantRouteId>(
  routeId: RouteId,
): AssistantRouteManifestEntry<RouteId> | null {
  const route = ASSISTANT_ROUTE_MANIFEST.find((candidate) => candidate.id === routeId);
  return (route as AssistantRouteManifestEntry<RouteId> | undefined) ?? null;
}

export function parseAssistantRouteParams<RouteId extends AssistantRouteId>(
  routeId: RouteId,
  params: unknown,
  options: { knownCategorySlugs?: readonly string[] } = {},
): AssistantRouteParamsById[RouteId] | null {
  const parsed = ASSISTANT_ROUTE_PARAM_SCHEMAS[routeId].safeParse(params);
  if (!parsed.success) return null;

  // Shared choke point: every navigation consumer inherits this check.
  if (routeId === "products" && options.knownCategorySlugs) {
    const category = (parsed.data as AssistantRouteParamsById["products"]).category;
    if (category && !areKnownCategorySlugs(category, options.knownCategorySlugs)) {
      return null;
    }
  }

  return parsed.data as AssistantRouteParamsById[RouteId];
}

/**
 * Bind already-validated route parameters into a logical, locale-neutral
 * navigation object. Transport consumers must still apply
 * `sanitizeAssistantNavigation` at their trust boundary.
 */
export function serializeAssistantRoute<RouteId extends AssistantRouteId>(
  routeId: RouteId,
  params: unknown,
  options: AssistantRouteSerializationOptions = {},
): AssistantNavigation | null {
  const route = getAssistantRouteManifestEntry(routeId);
  if (!route || !isAssistantRouteAvailable(route, options.storeMode)) return null;

  const parsedParams = parseAssistantRouteParams(routeId, params, {
    knownCategorySlugs: options.knownCategorySlugs,
  });
  if (!parsedParams) return null;

  // TypeScript cannot retain the correlation between `.find()` and the route
  // keyed schema above; it is established by parseAssistantRouteParams.
  return route.serialize(parsedParams as never);
}

export type AssistantRouteNavigation = {
  [RouteId in AssistantRouteId]: {
    routeId: RouteId;
    params: AssistantRouteParamsById[RouteId];
  };
}[AssistantRouteId];

export type AssistantRouteNavigationParseOptions = {
  /**
   * Sanitizers normally validate the route grammar independent of deployment
   * mode. External callers can opt into the current store-mode restriction.
   */
  storeMode?: AssistantStoreMode;
  enforceStoreMode?: boolean;
};

export function getAssistantRouteAllowedAnchors(
  routeId: AssistantRouteId,
): readonly string[] {
  if (!(routeId in ASSISTANT_ROUTE_ALLOWED_ANCHORS)) return [];
  return ASSISTANT_ROUTE_ALLOWED_ANCHORS[
    routeId as keyof typeof ASSISTANT_ROUTE_ALLOWED_ANCHORS
  ];
}

export function isAssistantRouteAnchorAllowed(
  routeId: AssistantRouteId,
  anchor: unknown,
) {
  return (
    typeof anchor === "string" &&
    getAssistantRouteAllowedAnchors(routeId).includes(anchor)
  );
}

function isAssistantNavigationShape(value: unknown): value is AssistantNavigation {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<AssistantNavigation>;
  return (
    typeof candidate.kind === "string" &&
    typeof candidate.destination === "string" &&
    typeof candidate.href === "string" &&
    candidate.href.length > 0 &&
    candidate.href.length <= 600 &&
    candidate.href.startsWith("/") &&
    !candidate.href.startsWith("//") &&
    !candidate.href.includes("\\")
  );
}

function parseAssistantProductFilterParams(url: URL) {
  const entries = [...url.searchParams.entries()];
  const allowedKeys = new Set([
    "q",
    "type",
    "minPrice",
    "maxPrice",
    "category",
    "material",
    "tag",
    "sort",
    "page",
  ]);
  if (
    entries.some(([key]) => !allowedKeys.has(key)) ||
    new Set(entries.map(([key]) => key)).size !== entries.length
  ) {
    return null;
  }

  const params: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (key === "minPrice" || key === "maxPrice" || key === "page") {
      if (!/^\d+$/.test(value)) return null;
      params[key] = Number(value);
    } else {
      params[key] = value;
    }
  }

  return parseAssistantRouteParams("products", params);
}

function getRouteParamsFromNavigationUrl(
  route: (typeof ASSISTANT_ROUTE_MANIFEST)[number],
  url: URL,
) {
  switch (route.id) {
    case "products":
      return url.pathname === ROUTES.products && !url.hash
        ? parseAssistantProductFilterParams(url)
        : null;
    case "product_detail":
      if (url.search || url.hash || !url.pathname.startsWith(`${ROUTES.products}/`)) {
        return null;
      }
      return parseAssistantRouteParams("product_detail", {
        slug: url.pathname.slice(`${ROUTES.products}/`.length),
      });
    case "order_detail":
      if (url.search || url.hash || !url.pathname.startsWith(`${ROUTES.accountOrders}/`)) {
        return null;
      }
      return parseAssistantRouteParams("order_detail", {
        id: url.pathname.slice(`${ROUTES.accountOrders}/`.length),
      });
    case "checkout_confirmation": {
      if (url.pathname !== ROUTES.checkoutConfirmation || url.hash) return null;
      const entries = [...url.searchParams.entries()];
      if (entries.length !== 1 || entries[0]?.[0] !== "order_id") return null;
      return parseAssistantRouteParams("checkout_confirmation", {
        orderId: entries[0][1],
      });
    }
    case "about":
    case "terms":
    case "privacy": {
      const baseHref = route.serialize({} as never).href;
      if (url.pathname !== baseHref || url.search) return null;
      return parseAssistantRouteParams(route.id, url.hash ? { anchor: url.hash.slice(1) } : {});
    }
    default: {
      const baseHref = route.serialize({} as never).href;
      return url.pathname === baseHref && !url.search && !url.hash
        ? parseAssistantRouteParams(route.id, {})
        : null;
    }
  }
}

/**
 * Reverse a canonical navigation object into its manifest route and typed
 * parameters. It is defensive enough to sit behind an `unknown` transport
 * payload and accepts no path/query/hash outside the manifest.
 */
export function parseAssistantRouteNavigation(
  value: unknown,
  options: AssistantRouteNavigationParseOptions = {},
): AssistantRouteNavigation | null {
  if (!isAssistantNavigationShape(value)) return null;

  let url: URL;
  try {
    url = new URL(value.href, "https://assistant.local");
  } catch {
    return null;
  }
  if (url.origin !== "https://assistant.local") return null;

  const route = ASSISTANT_ROUTE_MANIFEST.find(
    (candidate) =>
      candidate.kind === value.kind && candidate.destination === value.destination,
  );
  if (!route) return null;
  if (options.enforceStoreMode && !isAssistantRouteAvailable(route, options.storeMode)) {
    return null;
  }

  const params = getRouteParamsFromNavigationUrl(route, url);
  if (!params) return null;

  // Re-serialization rejects alternate encodings, redundant query syntax,
  // and any href that does not exactly originate from the manifest.
  const canonical = route.serialize(params as never);
  if (canonical.href !== value.href) return null;

  return { routeId: route.id, params } as AssistantRouteNavigation;
}

export function isAssistantRouteNavigation(
  value: unknown,
  options?: AssistantRouteNavigationParseOptions,
): value is AssistantNavigation {
  return parseAssistantRouteNavigation(value, options) !== null;
}

export function findAssistantRouteForNavigation(
  value: unknown,
  options?: AssistantRouteNavigationParseOptions,
): AssistantRouteManifestEntry | null {
  const parsed = parseAssistantRouteNavigation(value, options);
  return parsed ? getAssistantRouteManifestEntry(parsed.routeId) : null;
}

type JsonSchema = Record<string, unknown>;

function toJsonSchema(schema: z.ZodType): JsonSchema {
  const jsonSchema = z.toJSONSchema(schema) as JsonSchema;
  delete jsonSchema.$schema;
  return jsonSchema;
}

export type AssistantRouteManifestPromptEntry = {
  routeId: AssistantRouteId;
  description: string;
  examples: readonly string[];
  paramsSchema: JsonSchema;
};

/** A compact, locale-specific manifest for Gemini. It never contains hrefs. */
export function getAssistantRouteManifestPromptEntries(args: {
  locale: AssistantRouteLocale;
  storeMode?: AssistantStoreMode;
}): AssistantRouteManifestPromptEntry[] {
  return getAssistantRouteManifest({
    storeMode: args.storeMode,
    llmOnly: true,
    includeEntityRoutes: false,
  }).map((route) => ({
    routeId: route.id,
    description: route.copy[args.locale].description,
    examples: route.copy[args.locale].examples,
    paramsSchema: toJsonSchema(route.paramsSchema),
  }));
}

export type AssistantRouteManifestPublicEntry = Omit<
  AssistantRouteManifestEntry,
  "paramsSchema" | "serialize"
> & {
  paramsSchema: JsonSchema;
};

/** JSON-safe version suitable for llms.txt, an MCP surface, or diagnostics. */
export function getAssistantRouteManifestPublicEntries(
  options: AssistantRouteManifestOptions = {},
): AssistantRouteManifestPublicEntry[] {
  return getAssistantRouteManifest(options).map((route) => ({
    id: route.id,
    kind: route.kind,
    destination: route.destination,
    pathPattern: route.pathPattern,
    auth: route.auth,
    storeModes: route.storeModes,
    entityResolution: route.entityResolution,
    llmEnabled: route.llmEnabled,
    copy: route.copy,
    paramsSchema: toJsonSchema(route.paramsSchema),
  }));
}

/**
 * Gemini's responseJsonSchema. Each branch pins a route ID to its matching
 * parameter schema, while `routeId: null` represents an explicit safe miss.
 */
export function getAssistantRouteManifestResponseJsonSchema(options: {
  storeMode?: AssistantStoreMode;
} = {}): JsonSchema {
  const missBranch: JsonSchema = {
    type: "object",
    additionalProperties: false,
    required: ["routeId", "params"],
    properties: {
      routeId: { type: "null" },
      params: toJsonSchema(noAssistantRouteParamsSchema),
    },
    propertyOrdering: ["routeId", "params"],
  };

  const routeBranches = getAssistantRouteManifest({
    storeMode: options.storeMode,
    llmOnly: true,
    includeEntityRoutes: false,
  }).map((route) => ({
    type: "object",
    additionalProperties: false,
    required: ["routeId", "params"],
    properties: {
      routeId: { type: "string", enum: [route.id] },
      params: toJsonSchema(route.paramsSchema),
    },
    propertyOrdering: ["routeId", "params"],
  }));

  return { anyOf: [missBranch, ...routeBranches] };
}
