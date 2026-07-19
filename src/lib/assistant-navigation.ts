import {
  buildAssistantProductSearchQuery,
  buildAssistantSearchFilters,
} from "@/lib/assistant";
import { ROUTES, SORT_OPTIONS } from "@/lib/constants";
import type {
  AssistantNavigation,
  AssistantNavigationDestination,
  AssistantNavigationOption,
} from "@/types/search";

type StaticPageDestination = Extract<
  AssistantNavigationDestination,
  | "home"
  | "search"
  | "cart"
  | "checkout"
  | "wishlist"
  | "account"
  | "orders"
  | "addresses"
  | "about"
  | "visit"
  | "terms"
  | "privacy"
  | "login"
  | "signup"
  | "forgot_password"
>;

export type AssistantDynamicNavigationIntent =
  | {
      type: "product";
      query: string;
    }
  | {
      type: "order" | "confirmation";
      orderReference: string | null;
    };

const PAGE_DESTINATIONS: Record<StaticPageDestination, string> = {
  home: ROUTES.home,
  search: ROUTES.search,
  cart: ROUTES.cart,
  checkout: ROUTES.checkout,
  wishlist: ROUTES.wishlist,
  account: ROUTES.account,
  orders: ROUTES.accountOrders,
  addresses: ROUTES.accountAddresses,
  about: ROUTES.about,
  visit: ROUTES.visit,
  terms: ROUTES.termsAndConditions,
  privacy: ROUTES.privacyPolicy,
  login: ROUTES.login,
  signup: ROUTES.signup,
  forgot_password: ROUTES.forgotPassword,
};

const PRODUCT_QUERY_KEYS = new Set([
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

const PRODUCT_TYPES = new Set(["sale", "rental", "all"]);
const PRODUCT_SORT_VALUES: Set<string> = new Set(
  SORT_OPTIONS.map((option) => option.value),
);
const MAX_NAVIGATION_QUERY_LENGTH = 160;
const MAX_NAVIGATION_PRICE = 10_000_000;
const MAX_NAVIGATION_PAGE = 10_000;
const MAX_NAVIGATION_OPTIONS = 3;
const ORDER_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizedQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

const ENGLISH_NAVIGATION_VERB =
  "(?:take me(?: to)?|go to|open|navigate(?: me)?(?: to)?|bring me to|show(?: me)?)";

function isExplicitEnglishNavigationCommand(query: string) {
  const directCommand = new RegExp(
    `^(?:(?:please|hey(?: assistant)?|hi(?: assistant)?)[,!\\s]+)*${ENGLISH_NAVIGATION_VERB}\\b`,
    "i",
  );
  const politeRequest = new RegExp(
    `^(?:can|could|would|will)\\s+you\\s+${ENGLISH_NAVIGATION_VERB}\\b`,
    "i",
  );

  return directCommand.test(query) || politeRequest.test(query);
}

function isNavigationCommand(query: string) {
  return (
    isExplicitEnglishNavigationCommand(query) ||
    /(?:నన్ను|నాకు).*(?:తీసుకెళ్ల|తీసుకెళ్ళ|తీసుకువెళ్ల|తీసుకువెళ్ళ|వెళ్లండి|వెళ్ళండి)/.test(
      query,
    ) ||
    /(?:తెరవండి|ఓపెన్ చేయండి|పేజీకి వెళ్లండి|పేజీకి వెళ్ళండి|చూపించండి|చూపించు)/.test(query) ||
    /\b(?:nannu|naku|naaku)\b.*\b(?:teesukellandi|teeskellandi|tisukellandi|vellandi|velandi|teravandi|theravandi)\b/i.test(query) ||
    /\b(?:teesukellandi|teeskellandi|tisukellandi|vellandi|velandi|teravandi|theravandi|open cheyandi|chupinchandi|choopinchandi)\b/i.test(query)
  );
}

function isProductBrowseCommand(query: string) {
  const hasBrowseVerb =
    /\b(show|find|browse|view|look for|search for)\b/i.test(query) ||
    /(చూపించ|వెతక|చూడ)/.test(query);
  const hasProductTarget =
    /\b(products?|jewellery|jewelry|catalog|catalogue|collection|arrivals?|sets?|earrings?|necklaces?|bangles?|bracelets?|rings?|pendants?|chains?)\b/i.test(
      query,
    ) || /(?:ఉత్పత్త|జ్యువెల|నగలు|సెట్స్?|ఇయరింగ్స్?|హారాలు|గాజులు|ఉంగరాలు)/.test(query);

  return hasBrowseVerb && hasProductTarget;
}

function isDirectPasswordRecoveryCommand(query: string) {
  return /^(?:please\s+)?(?:forgot|reset)\s+(?:my\s+)?password[.!]?$/i.test(
    query.trim(),
  ) || /^(?:నా\s*)?పాస్(?:్|)వర్డ్\s*(?:మర్చిపోయాను|రీసెట్ చేయండి)[.!]?$/.test(query.trim());
}

function hasAny(query: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(query));
}

function isAdminRequest(query: string) {
  return /\badmin\b/i.test(query) || /అడ్మిన్/.test(query);
}

function extractOrderReference(query: string) {
  const orderNumber = query.match(/\bSC-[A-Z0-9]+-[A-Z0-9]{4}\b/i)?.[0];
  if (orderNumber) return orderNumber.toUpperCase();

  const uuid = query.match(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  )?.[0];
  if (uuid) return uuid.toLowerCase();

  return /\b(latest|last|recent|newest)\b/i.test(query) || /(?:తాజా|ఇటీవలి|చివరి)\s*ఆర్డర్/.test(query)
    ? "latest"
    : null;
}

function extractProductNavigationQuery(query: string) {
  const strippedEnglish = query
    .replace(
      new RegExp(
        `^(?:(?:please|hey(?: assistant)?|hi(?: assistant)?)[,!\\s]+)*(?:${ENGLISH_NAVIGATION_VERB})\\s+(?:me\\s+)?(?:to\\s+)?`,
        "i",
      ),
      "",
    )
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\b(?:product|item)(?:\s+(?:details?|page))?\b/gi, " ")
    .replace(/\b(?:details?|detail|page)\b/gi, " ")
    .trim();

  const strippedRomanized = strippedEnglish
    .replace(
      /^(?:nannu|naku|naaku)\s+(.+?)(?:\s+page)?\s+ki\s+(?:teesukellandi|teeskellandi|tisukellandi|vellandi|velandi|teravandi|theravandi)$/i,
      "$1",
    )
    .trim();

  const strippedTelugu = strippedRomanized
    .replace(
      /^(?:నన్ను|నాకు)\s+(.+?)(?:\s+పేజీకి)?\s*(?:తీసుకెళ్లండి|తీసుకెళ్ళండి|తీసుకువెళ్లండి|తీసుకువెళ్ళండి|వెళ్లండి|వెళ్ళండి)$/,
      "$1",
    )
    .replace(/(?:ఉత్పత్తి|ప్రొడక్ట్)\s*(?:వివరాలు|పేజీ)?/g, " ")
    .trim();

  return strippedTelugu.replace(/\s+/g, " ").slice(0, MAX_NAVIGATION_QUERY_LENGTH);
}

/**
 * Classify only explicit detail requests. Database lookups happen in the
 * server-only resolver, while this client-safe module owns command parsing and
 * transport validation.
 */
export function resolveAssistantDynamicNavigationIntent(
  query: string,
): AssistantDynamicNavigationIntent | null {
  const normalized = normalizedQuery(query);
  if (!normalized || isAdminRequest(normalized) || !isNavigationCommand(normalized)) {
    return null;
  }

  const isConfirmation = hasAny(normalized, [
    /\b(order )?(confirmation|receipt|success)\b/i,
    /(?:ఆర్డర్\s*)?(?:నిర్ధారణ|రసీదు|కన్ఫర్మేషన్)/,
  ]);
  if (isConfirmation) {
    return { type: "confirmation", orderReference: extractOrderReference(query) };
  }

  const hasOrderTarget =
    /\b(?:my )?order\b/i.test(normalized) || /(?:నా\s*)?ఆర్డర్/.test(normalized);
  const isOrderList =
    /\b(?:my )?orders(?: page)?\b/i.test(normalized) ||
    /\border history\b/i.test(normalized) ||
    /(?:నా\s*)?ఆర్డర్లు|ఆర్డర్ హిస్టరీ/.test(normalized);
  if (hasOrderTarget && !isOrderList) {
    return { type: "order", orderReference: extractOrderReference(query) };
  }

  const hasProductTarget =
    /\b(?:product|item|set|earring|necklace|bangle|bracelet|ring|pendant|chain)\b/i.test(
      normalized,
    ) || /(?:ఉత్పత్తి|ప్రొడక్ట్|సెట్|ఇయరింగ్|హారం|గాజు|ఉంగరం)/.test(normalized);
  const isProductList =
    /\b(?:products|catalog|catalogue|collection)\b/i.test(normalized) ||
    /\bproduct\s+page\b/i.test(normalized) ||
    /(?:ఉత్పత్తుల|కాటలాగ్|కలెక్షన్)\s*పేజీ?/.test(normalized);
  if (hasProductTarget && !isProductList) {
    const productQuery = extractProductNavigationQuery(query);
    if (productQuery) {
      return { type: "product", query: productQuery };
    }
  }

  return null;
}

function resolvePageDestination(query: string): StaticPageDestination | null {
  if (hasAny(query, [/\b(terms?(?: and conditions)?|conditions of use)\b/i, /(?:నిబంధన|షరత)/])) {
    return "terms";
  }
  if (hasAny(query, [/\b(privacy|privacy policy)\b/i, /(?:ప్రైవసీ|గోప్యత)/])) {
    return "privacy";
  }
  if (hasAny(query, [/\b((?:my )?orders(?: page)?|order history)\b/i, /(?:నా ఆర్డర్లు|ఆర్డర్ హిస్టరీ)/])) {
    return "orders";
  }
  if (hasAny(query, [/\b(addresses?(?: page)?|saved addresses)\b/i, /(?:నా చిరునామ|సేవ్ చేసిన చిరునామ)/])) {
    return "addresses";
  }
  if (hasAny(query, [/\b((?:my )?account(?: page)?|profile)\b/i, /(?:నా ఖాతా|అకౌంట్|ప్రొఫైల్)/])) {
    return "account";
  }
  if (hasAny(query, [/\b(checkout|payment page)\b/i, /(?:చెక్అవుట్|చెల్లింపు పేజీ)/])) {
    return "checkout";
  }
  if (hasAny(query, [/\b(cart|shopping bag)\b/i, /(?:కార్ట్|షాపింగ్ బ్యాగ్)/])) {
    return "cart";
  }
  if (hasAny(query, [/\b(wishlist|favo(?:u)?rites|saved items)\b/i, /(?:విష్‌లిస్ట్|ఇష్టమైనవి|ఫేవరెట్స్)/])) {
    return "wishlist";
  }
  if (hasAny(query, [/\b(visit(?: us)?|store location|store address|directions|location page)\b/i, /(?:స్టోర్.*(?:స్థాన|చిరునామ)|సందర్శించండి|లోకేషన్)/])) {
    return "visit";
  }
  if (hasAny(query, [/\b(about(?: us| the store| the shop)?|store information|about page|faq)\b/i, /(?:మా గురించి|స్టోర్ సమాచారం గురించి|తరచుగా అడిగే ప్రశ్నలు)/])) {
    return "about";
  }
  if (hasAny(query, [/\b(?:log ?in|sign ?in|login page)\b/i, /(?:లాగిన్|సైన్ ఇన్)/])) {
    return "login";
  }
  if (hasAny(query, [/\b(?:sign ?up|register|create (?:an )?account)\b/i, /(?:సైన్ అప్|రిజిస్టర్|ఖాతా తెరవ)/])) {
    return "signup";
  }
  if (hasAny(query, [/\b(?:forgot|reset) (?:my )?password\b|\bpassword recovery\b/i, /(?:పాస్‌వర్డ్|పాస్ వర్డ్).*(?:మర్చ|రీసెట్|రికవరీ)/])) {
    return "forgot_password";
  }
  if (hasAny(query, [/\b(search(?: page)?|product search)\b/i, /(?:సెర్చ్ పేజీ|ఉత్పత్తి సెర్చ్)/])) {
    return "search";
  }
  if (hasAny(query, [/\b(home(?: page)?|homepage|main page|start page)\b/i, /(?:హోమ్ పేజీ|మొదటి పేజీ)/])) {
    return "home";
  }

  return null;
}

/** Strip "take me to the …" style lead-ins plus page/collection filler so the
 *  residual free text can become a clean q= search term. */
function stripNavigationCommandPhrases(query: string) {
  return query
    .replace(
      new RegExp(
        `^(?:(?:please|hey(?: assistant)?|hi(?: assistant)?)[,!\\s]+)*(?:(?:can|could|would|will)\\s+you\\s+)?(?:${ENGLISH_NAVIGATION_VERB})\\s+(?:me\\s+)?(?:to\\s+)?`,
        "i",
      ),
      "",
    )
    .replace(/\b(?:pages?|catalog(?:ue)?s?|collections?)\b/gi, " ");
}

function buildProductsNavigation(query: string): AssistantNavigation {
  const filters = buildAssistantSearchFilters(query);
  const type = filters?.type || (filters?.maxPrice ? "rental" : undefined);
  const params = new URLSearchParams();

  if (type && type !== "all") params.set("type", type);
  if (filters?.minPrice) params.set("minPrice", String(filters.minPrice));
  if (filters?.maxPrice) params.set("maxPrice", String(filters.maxPrice));
  if (filters?.tags?.length) params.set("tag", filters.tags.join(","));
  if (filters?.materials?.length) params.set("material", filters.materials.join(","));
  // Explicit cheapness cues only — a plain price cap ("under 1000") keeps the
  // default sort.
  if (/\b(cheap(?:est|er)?|lowest|least expensive|most affordable)\b/i.test(query) || /(చౌక|తక్కువ ధర)/.test(query)) {
    params.set("sort", "price-asc");
  }

  const rawSearchQuery = buildAssistantProductSearchQuery({
    latestUserMessage: stripNavigationCommandPhrases(query),
  });
  const searchQuery = rawSearchQuery
    .replace(/^(?:rental|sale)(?:\s+|$)/i, "")
    .trim();

  if (searchQuery && !/^(jewellery|jewelry)$/i.test(searchQuery)) {
    params.set("q", searchQuery);
  }

  const suffix = params.toString();
  return {
    kind: "product_filters",
    destination: "products",
    href: suffix ? `${ROUTES.products}?${suffix}` : ROUTES.products,
  };
}

/** Resolve static routes and catalogue filters. Dynamic detail lookups run server-side. */
export function resolveAssistantNavigation(query: string): AssistantNavigation | null {
  const normalized = normalizedQuery(query);
  if (!normalized || isAdminRequest(normalized)) return null;
  if (resolveAssistantDynamicNavigationIntent(query)) return null;

  const isProductRequest =
    isProductBrowseCommand(normalized) ||
    (isNavigationCommand(normalized) &&
      /\b(products?|jewellery|jewelry|catalog|catalogue|collection|arrivals?)\b/i.test(normalized));
  if (
    !isNavigationCommand(normalized) &&
    !isProductRequest &&
    !isDirectPasswordRecoveryCommand(query)
  ) {
    return null;
  }

  const pageDestination = resolvePageDestination(normalized);
  if (pageDestination) {
    return {
      kind: "page",
      destination: pageDestination,
      href: PAGE_DESTINATIONS[pageDestination],
    };
  }

  return isProductRequest ? buildProductsNavigation(query) : null;
}

function isPositiveBoundedInteger(value: string, maximum: number) {
  if (!/^\d+$/.test(value)) return false;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= maximum;
}

function isBoundedText(value: string, maximum: number) {
  return value.length > 0 && value.length <= maximum && !/[\u0000-\u001F\u007F]/.test(value);
}

function hasValidProductNavigationParams(url: URL) {
  const entries = [...url.searchParams.entries()];
  if (
    entries.some(([key]) => !PRODUCT_QUERY_KEYS.has(key)) ||
    new Set(entries.map(([key]) => key)).size !== entries.length
  ) {
    return false;
  }

  const type = url.searchParams.get("type");
  if (type && !PRODUCT_TYPES.has(type)) return false;

  const minPrice = url.searchParams.get("minPrice");
  const maxPrice = url.searchParams.get("maxPrice");
  if (
    (minPrice && !isPositiveBoundedInteger(minPrice, MAX_NAVIGATION_PRICE)) ||
    (maxPrice && !isPositiveBoundedInteger(maxPrice, MAX_NAVIGATION_PRICE)) ||
    (minPrice && maxPrice && Number(minPrice) > Number(maxPrice))
  ) {
    return false;
  }

  const page = url.searchParams.get("page");
  if (page && !isPositiveBoundedInteger(page, MAX_NAVIGATION_PAGE)) return false;

  const sort = url.searchParams.get("sort");
  if (sort && !PRODUCT_SORT_VALUES.has(sort)) return false;

  return ["q", "category", "material", "tag"].every((key) => {
    const value = url.searchParams.get(key);
    return value === null || isBoundedText(value, MAX_NAVIGATION_QUERY_LENGTH);
  });
}

export function sanitizeAssistantNavigation(value: unknown): AssistantNavigation | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<AssistantNavigation>;
  if (
    !["page", "product_filters", "product_detail", "order_detail", "checkout_confirmation"].includes(
      candidate.kind ?? "",
    ) ||
    typeof candidate.destination !== "string" ||
    typeof candidate.href !== "string" ||
    candidate.href.length === 0 ||
    candidate.href.length > 600 ||
    !candidate.href.startsWith("/") ||
    candidate.href.startsWith("//") ||
    candidate.href.includes("\\")
  ) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(candidate.href, "https://assistant.local");
  } catch {
    return null;
  }
  if (url.origin !== "https://assistant.local" || url.pathname.includes("..") || url.hash) {
    return null;
  }

  if (candidate.kind === "page") {
    if (
      !(candidate.destination in PAGE_DESTINATIONS) ||
      PAGE_DESTINATIONS[candidate.destination as StaticPageDestination] !== candidate.href
    ) {
      return null;
    }
  } else if (
    candidate.kind === "product_filters" &&
    (candidate.destination !== "products" ||
      url.pathname !== ROUTES.products ||
      !hasValidProductNavigationParams(url))
  ) {
    return null;
  } else if (
    candidate.kind === "product_detail" &&
    (candidate.destination !== "product_detail" ||
      url.search ||
      !PRODUCT_SLUG_PATTERN.test(url.pathname.slice(`${ROUTES.products}/`.length)) ||
      candidate.href !== ROUTES.product(url.pathname.slice(`${ROUTES.products}/`.length)))
  ) {
    return null;
  } else if (
    candidate.kind === "order_detail" &&
    (candidate.destination !== "order_detail" ||
      url.search ||
      !ORDER_UUID_PATTERN.test(url.pathname.slice(`${ROUTES.accountOrders}/`.length)) ||
      candidate.href !== ROUTES.accountOrder(url.pathname.slice(`${ROUTES.accountOrders}/`.length)))
  ) {
    return null;
  } else if (
    candidate.kind === "checkout_confirmation" &&
    (candidate.destination !== "checkout_confirmation" ||
      url.pathname !== ROUTES.checkoutConfirmation ||
      [...url.searchParams.keys()].length !== 1 ||
      !ORDER_UUID_PATTERN.test(url.searchParams.get("order_id") ?? ""))
  ) {
    return null;
  }

  return {
    kind: candidate.kind as AssistantNavigation["kind"],
    destination: candidate.destination as AssistantNavigationDestination,
    href: candidate.href,
  };
}

export function sanitizeAssistantNavigationOptions(
  value: unknown,
): AssistantNavigationOption[] {
  if (!Array.isArray(value)) return [];

  return value
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as Partial<AssistantNavigationOption>;
      const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
      const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
      const description =
        typeof candidate.description === "string" ? candidate.description.trim() : null;
      const navigation = sanitizeAssistantNavigation(candidate.navigation);
      if (
        !isBoundedText(id, 120) ||
        !isBoundedText(label, 180) ||
        (description !== null && !isBoundedText(description, 180)) ||
        !navigation
      ) {
        return [];
      }

      return [{ id, label, description, navigation }];
    })
    .slice(0, MAX_NAVIGATION_OPTIONS);
}
