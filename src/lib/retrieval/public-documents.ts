import { createHash } from "node:crypto";
import enAbout from "../../../messages/en/about.json";
import enLegal from "../../../messages/en/legal.json";
import teAbout from "../../../messages/te/about.json";
import teLegal from "../../../messages/te/legal.json";
import {
  APP_NAME,
  BUSINESS_INFO,
  CURRENCY_SYMBOL,
  FREE_SHIPPING_THRESHOLD,
  ROUTES,
  SHIPPING_COST,
} from "@/lib/constants";
import {
  serializeAssistantRoute,
  type AssistantRouteId,
} from "@/lib/assistant-route-manifest";
import type { Json } from "@/types/database";
import type { CatalogSourceType } from "@/types/search";

const ABOUT_MESSAGES = {
  en: enAbout,
  te: teAbout,
} as const;

const LEGAL_MESSAGES = {
  en: enLegal,
  te: teLegal,
} as const;

const TERMS_SECTION_KEYS = [
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
] as const;

const PRIVACY_LIST_SECTION_KEYS = [
  {
    key: "informationWeCollect",
    items: ["account", "google", "shipping", "order", "usage"] as const,
  },
  {
    key: "howWeUse",
    items: ["orders", "account", "communicate", "improve", "security"] as const,
  },
] as const;

const PRIVACY_TEXT_SECTION_KEYS = [
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
] as const;

type SupportedPublicLocale = "en" | "te";

type StaticRouteDocument = {
  id: AssistantRouteId;
  title: string;
  content: string;
};

/**
 * These are deliberately retrieval documents rather than a second route
 * authority. The assistant route manifest remains canonical and supplies each
 * href at build time; these documents only give hybrid retrieval a concise,
 * bilingual description of the customer pages it can ground. Keeping them in
 * the existing `store_info` source type avoids a schema migration and lets
 * the existing public-document sync keep them fresh.
 */
const STATIC_ROUTE_DOCUMENTS: Record<
  SupportedPublicLocale,
  readonly StaticRouteDocument[]
> = {
  en: [
    {
      id: "home",
      title: "Home",
      content: "Home page with featured jewellery and new arrivals.",
    },
    {
      id: "products",
      title: "Products catalog",
      content:
        "Browse all jewellery. Filter the catalog by category, material, tag, price, and sale or rental availability.",
    },
    {
      id: "search",
      title: "Product search",
      content: "Search the current jewellery catalog by product name, style, or material.",
    },
    {
      id: "cart",
      title: "Shopping cart",
      content: "Review products selected for purchase or rental in the shopping cart.",
    },
    {
      id: "checkout",
      title: "Checkout and payment",
      content: "Enter delivery details and pay securely online for the current cart.",
    },
    {
      id: "wishlist",
      title: "Wishlist",
      content: "View jewellery products saved as favourites.",
    },
    {
      id: "account",
      title: "My account",
      content: "Manage the customer profile, account information, and account settings.",
    },
    {
      id: "orders",
      title: "My orders",
      content: "View order history and the status of customer orders.",
    },
    {
      id: "addresses",
      title: "Saved addresses",
      content: "Manage delivery addresses saved to the customer account.",
    },
    {
      id: "about",
      title: "About Bhagyalakshmi Future Gold",
      content: "Read the store story, quality promise, frequently asked questions, and business information.",
    },
    {
      id: "visit",
      title: "Visit the store",
      content: "Find the Chirala store location, directions, contact details, and opening hours.",
    },
    {
      id: "terms",
      title: "Terms and conditions",
      content: "Read terms covering products, pricing, orders, payments, shipping, returns, and rentals.",
    },
    {
      id: "privacy",
      title: "Privacy policy",
      content: "Read how customer information is collected, used, protected, retained, and controlled.",
    },
    {
      id: "login",
      title: "Log in",
      content: "Sign in to an existing customer account.",
    },
    {
      id: "signup",
      title: "Create an account",
      content: "Create a new customer account to save addresses, orders, and favourites.",
    },
    {
      id: "forgot_password",
      title: "Password recovery",
      content: "Request a password reset for a customer account.",
    },
  ],
  te: [
    {
      id: "home",
      title: "హోమ్",
      content: "ఫీచర్డ్ నగలు మరియు కొత్త డిజైన్లతో హోమ్ పేజీ.",
    },
    {
      id: "products",
      title: "ఉత్పత్తుల కాటలాగ్",
      content:
        "అన్ని నగలను చూడండి. వర్గం, మెటీరియల్, ట్యాగ్, ధర, అమ్మకం లేదా అద్దె ఆధారంగా ఫిల్టర్ చేయండి.",
    },
    {
      id: "search",
      title: "ఉత్పత్తి శోధన",
      content: "ఉత్పత్తి పేరు, స్టైల్ లేదా మెటీరియల్‌తో ప్రస్తుత కాటలాగ్‌ను వెతకండి.",
    },
    {
      id: "cart",
      title: "షాపింగ్ కార్ట్",
      content: "కొనుగోలు లేదా అద్దెకు ఎంచుకున్న ఉత్పత్తులను కార్ట్‌లో చూడండి.",
    },
    {
      id: "checkout",
      title: "చెక్అవుట్ మరియు చెల్లింపు",
      content: "డెలివరీ వివరాలు ఇచ్చి ప్రస్తుత కార్ట్‌కు ఆన్‌లైన్‌లో సురక్షితంగా చెల్లించండి.",
    },
    {
      id: "wishlist",
      title: "విష్‌లిస్ట్",
      content: "ఇష్టమైనవిగా సేవ్ చేసిన నగల ఉత్పత్తులను చూడండి.",
    },
    {
      id: "account",
      title: "నా ఖాతా",
      content: "కస్టమర్ ప్రొఫైల్, ఖాతా సమాచారం మరియు సెట్టింగ్‌లను నిర్వహించండి.",
    },
    {
      id: "orders",
      title: "నా ఆర్డర్లు",
      content: "ఆర్డర్ చరిత్ర మరియు కస్టమర్ ఆర్డర్ల స్థితిని చూడండి.",
    },
    {
      id: "addresses",
      title: "సేవ్ చేసిన చిరునామాలు",
      content: "కస్టమర్ ఖాతాలో సేవ్ చేసిన డెలివరీ చిరునామాలను నిర్వహించండి.",
    },
    {
      id: "about",
      title: "భాగ్యలక్ష్మి ఫ్యూచర్ గోల్డ్ గురించి",
      content: "స్టోర్ కథ, నాణ్యత హామీ, తరచుగా అడిగే ప్రశ్నలు మరియు వ్యాపార సమాచారం చదవండి.",
    },
    {
      id: "visit",
      title: "స్టోర్‌ను సందర్శించండి",
      content: "చీరాల స్టోర్ లొకేషన్, దారులు, సంప్రదింపు వివరాలు మరియు పని వేళలను చూడండి.",
    },
    {
      id: "terms",
      title: "నిబంధనలు మరియు షరతులు",
      content: "ఉత్పత్తులు, ధరలు, ఆర్డర్లు, చెల్లింపులు, షిప్పింగ్, రిటర్న్స్ మరియు అద్దె నిబంధనలు చదవండి.",
    },
    {
      id: "privacy",
      title: "గోప్యతా విధానం",
      content: "కస్టమర్ సమాచారాన్ని ఎలా సేకరిస్తారు, ఉపయోగిస్తారు, రక్షిస్తారు మరియు నియంత్రిస్తారో చదవండి.",
    },
    {
      id: "login",
      title: "లాగిన్",
      content: "ఇప్పటికే ఉన్న కస్టమర్ ఖాతాలోకి సైన్ ఇన్ అవ్వండి.",
    },
    {
      id: "signup",
      title: "ఖాతా తెరవండి",
      content: "చిరునామాలు, ఆర్డర్లు మరియు ఇష్టమైన ఉత్పత్తులను సేవ్ చేయడానికి కొత్త కస్టమర్ ఖాతాను తెరవండి.",
    },
    {
      id: "forgot_password",
      title: "పాస్‌వర్డ్ రికవరీ",
      content: "కస్టమర్ ఖాతాకు పాస్‌వర్డ్ రీసెట్‌ను అభ్యర్థించండి.",
    },
  ],
};

export interface PublicCatalogSummaryProduct {
  id: string;
  name: string;
  name_telugu: string | null;
  slug: string;
  material: string | null;
  tags: string[];
  is_sale: boolean;
  is_rental: boolean;
  price: number;
  discount_price: number | null;
  rental_price: number | null;
  rental_discount_price: number | null;
  category: {
    name: string;
    name_telugu: string | null;
    slug: string;
  } | null;
}

interface RetrievalDocumentInput {
  sourceType: CatalogSourceType;
  sourceKey: string;
  productId: string | null;
  locale: string;
  title: string;
  content: string;
  metadata: Json;
  contentHash: string;
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function buildContentHash(value: {
  title: string;
  content: string;
  metadata: Json;
}) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function createRetrievalDocument(args: {
  sourceType: Exclude<CatalogSourceType, "product">;
  sourceKey: string;
  locale: SupportedPublicLocale;
  title: string;
  content: string;
  metadata: Json;
}): RetrievalDocumentInput {
  return {
    sourceType: args.sourceType,
    sourceKey: args.sourceKey,
    productId: null,
    locale: args.locale,
    title: args.title,
    content: args.content,
    metadata: args.metadata,
    contentHash: buildContentHash({
      title: args.title,
      content: args.content,
      metadata: args.metadata,
    }),
  };
}

function getProductDisplayName(
  product: PublicCatalogSummaryProduct,
  locale: SupportedPublicLocale
) {
  if (locale === "te" && product.name_telugu) {
    return product.name_telugu;
  }

  return product.name;
}

function getCategoryDisplayName(
  category: PublicCatalogSummaryProduct["category"],
  locale: SupportedPublicLocale
) {
  if (!category) {
    return locale === "te" ? "వర్గీకరించని ఉత్పత్తులు" : "Uncategorised products";
  }

  if (locale === "te" && category.name_telugu) {
    return category.name_telugu;
  }

  return category.name;
}

function buildStoreOverviewDocument(locale: SupportedPublicLocale) {
  const about = ABOUT_MESSAGES[locale];
  const address = [
    BUSINESS_INFO.address.street,
    BUSINESS_INFO.address.city,
    `${BUSINESS_INFO.address.district} Dist.`,
    BUSINESS_INFO.address.state,
    BUSINESS_INFO.address.pincode,
    BUSINESS_INFO.address.country,
  ]
    .filter(Boolean)
    .join(", ");

  const title =
    locale === "te"
      ? `${APP_NAME} స్టోర్ అవలోకనం`
      : `${APP_NAME} Store Overview`;

  const owner =
    locale === "te"
      ? `యజమాని (ఓనర్ / ప్రొప్రయిటర్): దరిసి భాగ్యలక్ష్మి (${BUSINESS_INFO.proprietor.name}). ${APP_NAME} స్టోర్ మరియు ఈ వెబ్సైట్‌ను ఆమె నిర్వహిస్తారు.`
      : `Owner (Proprietor): ${BUSINESS_INFO.proprietor.name}. The ${APP_NAME} store and this website are owned and run by ${BUSINESS_INFO.proprietor.name}.`;

  const content = [
    `${about.label}: ${about.tagline}`,
    about.mission,
    about.storyShort,
    about.qualityProcess,
    owner,
    `${about.address}: ${address}`,
    `${about.phone}: ${BUSINESS_INFO.phone}`,
    `${about.email}: ${BUSINESS_INFO.email}`,
    `${about.businessHours}: ${about.monSat} ${BUSINESS_INFO.hours.weekdays}; ${about.sunday} ${BUSINESS_INFO.hours.sunday}`,
  ]
    .filter(Boolean)
    .join("\n");

  return createRetrievalDocument({
    sourceType: "store_info",
    sourceKey: `store_info:${locale}:overview`,
    locale,
    title,
    content,
    metadata: {
      href: `${ROUTES.about}#store-info`,
      page: ROUTES.about,
      sectionKey: "store-info",
      summaryKind: "overview",
    },
  });
}

function buildSiteGuideDocument(locale: SupportedPublicLocale) {
  const title =
    locale === "te"
      ? `${APP_NAME} వెబ్సైట్ గైడ్ మరియు సైట్‌మ్యాప్`
      : `${APP_NAME} website guide and sitemap`;

  const content =
    locale === "te"
      ? [
          `ఈ వెబ్సైట్ (${APP_NAME}) లోని ముఖ్యమైన పేజీలు:`,
          `హోమ్ (${ROUTES.home}): ఫీచర్డ్ జ్యువెలరీ మరియు కొత్త డిజైన్లు.`,
          `ఉత్పత్తులు (${ROUTES.products}): వర్గం, ధర, మెటీరియల్ ఫిల్టర్లతో పూర్తి కాటలాగ్. ప్రతి ఉత్పత్తికి సొంత వివరాల పేజీ ఉంటుంది.`,
          `సెర్చ్ (${ROUTES.search}): ఉత్పత్తులను వెతకవచ్చు.`,
          `కార్ట్ (${ROUTES.cart}) మరియు చెక్అవుట్ (${ROUTES.checkout}): ఎంచుకున్న వస్తువులను చూసి Razorpay ద్వారా ఆన్‌లైన్‌లో సురక్షితంగా చెల్లించవచ్చు.`,
          `విష్‌లిస్ట్ (${ROUTES.wishlist}): నచ్చిన ఉత్పత్తులను సేవ్ చేసుకోవచ్చు.`,
          `అకౌంట్ (${ROUTES.account}): ప్రొఫైల్, సేవ్ చేసిన చిరునామాలు, మరియు ఆర్డర్ హిస్టరీ (${ROUTES.accountOrders}).`,
          `మా గురించి (${ROUTES.about}): స్టోర్ కథ, యజమాని వివరాలు, FAQ, మరియు వ్యాపార సమాచారం.`,
          `స్టోర్ సందర్శన (${ROUTES.visit}): చీరాలలోని స్టోర్ లొకేషన్, మ్యాప్, మరియు పని వేళలు.`,
          `చట్టపరమైనవి: నిబంధనలు (${ROUTES.termsAndConditions}) మరియు ప్రైవసీ పాలసీ (${ROUTES.privacyPolicy}).`,
          `లాగిన్ (${ROUTES.login}) మరియు సైన్అప్ (${ROUTES.signup}) తో అకౌంట్ ప్రారంభించవచ్చు.`,
        ].join("\n")
      : [
          `Main pages on this ${APP_NAME} website:`,
          `Home (${ROUTES.home}): featured jewellery and new arrivals.`,
          `Products (${ROUTES.products}): the full catalog with category, price, and material filters. Every product has its own detail page.`,
          `Search (${ROUTES.search}): search across the catalog.`,
          `Cart (${ROUTES.cart}) and Checkout (${ROUTES.checkout}): review selected items and pay securely online via Razorpay.`,
          `Wishlist (${ROUTES.wishlist}): save favourite products.`,
          `Account (${ROUTES.account}): profile, saved addresses, and order history (${ROUTES.accountOrders}).`,
          `About (${ROUTES.about}): the store story, owner details, FAQ, and business information.`,
          `Visit (${ROUTES.visit}): store location in Chirala with map and opening hours.`,
          `Legal: terms and conditions (${ROUTES.termsAndConditions}) and privacy policy (${ROUTES.privacyPolicy}).`,
          `Login (${ROUTES.login}) and signup (${ROUTES.signup}) to create an account.`,
        ].join("\n");

  return createRetrievalDocument({
    sourceType: "store_info",
    sourceKey: `store_info:${locale}:site-guide`,
    locale,
    title,
    content,
    metadata: {
      href: ROUTES.home,
      page: ROUTES.home,
      sectionKey: "site-guide",
      summaryKind: "site-guide",
    },
  });
}

function buildStaticRouteDocuments(locale: SupportedPublicLocale) {
  return STATIC_ROUTE_DOCUMENTS[locale].flatMap((route) => {
    const navigation = serializeAssistantRoute(route.id, {});
    if (!navigation) return [];

    return [
      createRetrievalDocument({
        sourceType: "store_info",
        sourceKey: `store_info:${locale}:route:${route.id}`,
        locale,
        title: route.title,
        content: route.content,
        metadata: {
          href: navigation.href,
          page: navigation.href,
          sectionKey: "route",
          summaryKind: "route",
          routeId: route.id,
        },
      }),
    ];
  });
}

function buildMaterialsSummaryDocument(
  locale: SupportedPublicLocale,
  products: PublicCatalogSummaryProduct[]
) {
  const materialGroups = new Map<string, PublicCatalogSummaryProduct[]>();

  for (const product of products) {
    const material = normalizeText(product.material);
    if (!material) {
      continue;
    }

    const existing = materialGroups.get(material) ?? [];
    existing.push(product);
    materialGroups.set(material, existing);
  }

  const sortedGroups = [...materialGroups.entries()].sort((left, right) => {
    if (right[1].length !== left[1].length) {
      return right[1].length - left[1].length;
    }

    return left[0].localeCompare(right[0]);
  });

  const title =
    locale === "te"
      ? `${APP_NAME} లో ఉపయోగించే మెటీరియల్స్`
      : `Materials used at ${APP_NAME}`;

  const content =
    sortedGroups.length === 0
      ? locale === "te"
        ? "ప్రస్తుతం యాక్టివ్ కాటలాగ్‌లో మెటీరియల్ వివరాలు కలిగిన ఉత్పత్తులు లేవు."
        : "There are currently no active catalog products with material details."
      : [
          locale === "te"
            ? "ప్రస్తుతం యాక్టివ్ కాటలాగ్‌లో కనిపిస్తున్న మెటీరియల్స్ ఇవి:"
            : "These materials currently appear in the active catalog:",
          ...sortedGroups.map(([material, items]) => {
            const examples = items
              .slice(0, 3)
              .map((product) => getProductDisplayName(product, locale))
              .join(", ");

            return locale === "te"
              ? `${material}: ${items.length} ఉత్పత్తులు. ఉదాహరణలు: ${examples}.`
              : `${material}: ${items.length} products. Examples: ${examples}.`;
          }),
          locale === "te"
            ? "ప్రతి ఉత్పత్తి పేజీలో ఖచ్చితమైన ఫినిష్ మరియు మెటీరియల్ వివరాలు చూడండి."
            : "Check each product page for the exact finish and material details.",
        ].join("\n");

  return createRetrievalDocument({
    sourceType: "store_info",
    sourceKey: `store_info:${locale}:materials`,
    locale,
    title,
    content,
    metadata: {
      href: `${ROUTES.about}#quality-promise`,
      page: ROUTES.about,
      sectionKey: "quality-promise",
      summaryKind: "materials",
    },
  });
}

function buildCatalogCoverageDocument(
  locale: SupportedPublicLocale,
  products: PublicCatalogSummaryProduct[]
) {
  const categoryGroups = new Map<string, PublicCatalogSummaryProduct[]>();

  for (const product of products) {
    const categoryName = getCategoryDisplayName(product.category, locale);
    const existing = categoryGroups.get(categoryName) ?? [];
    existing.push(product);
    categoryGroups.set(categoryName, existing);
  }

  const sortedCategories = [...categoryGroups.entries()].sort((left, right) => {
    if (right[1].length !== left[1].length) {
      return right[1].length - left[1].length;
    }

    return left[0].localeCompare(right[0]);
  });

  const title =
    locale === "te"
      ? `${APP_NAME} కాటలాగ్ వర్గాలు మరియు ఉత్పత్తి కవరేజ్`
      : `${APP_NAME} category and product coverage`;

  const content =
    sortedCategories.length === 0
      ? locale === "te"
        ? "ప్రస్తుతం యాక్టివ్ కాటలాగ్‌లో ఉత్పత్తులు లేవు."
        : "There are currently no active catalog products."
      : [
          locale === "te"
            ? "ప్రస్తుతం కాటలాగ్‌లో ఉన్న వర్గాలు మరియు ఉదాహరణ ఉత్పత్తులు:"
            : "These categories and example products are currently available in the catalog:",
          ...sortedCategories.map(([categoryName, items]) => {
            const examples = items
              .slice(0, 3)
              .map((product) => getProductDisplayName(product, locale))
              .join(", ");

            return locale === "te"
              ? `${categoryName}: ${items.length} ఉత్పత్తులు. ఉదాహరణలు: ${examples}.`
              : `${categoryName}: ${items.length} products. Examples: ${examples}.`;
          }),
          locale === "te"
            ? "కొన్ని వర్గాలు అమ్మకానికి, కొన్ని అద్దెకు, మరికొన్ని రెండింటికీ అందుబాటులో ఉండవచ్చు."
            : "Some categories may be available for sale, rent, or both depending on the product.",
        ].join("\n");

  return createRetrievalDocument({
    sourceType: "store_info",
    sourceKey: `store_info:${locale}:catalog-coverage`,
    locale,
    title,
    content,
    metadata: {
      href: ROUTES.products,
      page: ROUTES.products,
      sectionKey: "catalog-coverage",
      summaryKind: "catalog-coverage",
    },
  });
}

function buildShoppingOptionsDocument(
  locale: SupportedPublicLocale,
  products: PublicCatalogSummaryProduct[]
) {
  const saleOnly = products.filter((product) => product.is_sale && !product.is_rental);
  const rentalOnly = products.filter((product) => product.is_rental && !product.is_sale);
  const saleAndRental = products.filter(
    (product) => product.is_sale && product.is_rental
  );
  const rentalExamples = rentalOnly
    .concat(saleAndRental)
    .slice(0, 4)
    .map((product) => getProductDisplayName(product, locale))
    .join(", ");

  const title =
    locale === "te"
      ? `${APP_NAME} అమ్మకం, అద్దె మరియు షిప్పింగ్ సారాంశం`
      : `${APP_NAME} sale, rental, and shipping summary`;

  const content = [
    locale === "te"
      ? `అమ్మకానికి మాత్రమే: ${saleOnly.length} ఉత్పత్తులు.`
      : `Sale only: ${saleOnly.length} products.`,
    locale === "te"
      ? `అద్దెకు మాత్రమే: ${rentalOnly.length} ఉత్పత్తులు.`
      : `Rental only: ${rentalOnly.length} products.`,
    locale === "te"
      ? `అమ్మకానికి మరియు అద్దెకు రెండింటికీ: ${saleAndRental.length} ఉత్పత్తులు.`
      : `Available for both sale and rent: ${saleAndRental.length} products.`,
    rentalExamples
      ? locale === "te"
        ? `అద్దె ఉదాహరణలు: ${rentalExamples}.`
        : `Rental examples: ${rentalExamples}.`
      : null,
    locale === "te"
      ? `${CURRENCY_SYMBOL}${FREE_SHIPPING_THRESHOLD} పై ఆర్డర్లకు ఉచిత షిప్పింగ్. అంతకంటే తక్కువకు ${CURRENCY_SYMBOL}${SHIPPING_COST} షిప్పింగ్ ఛార్జ్ ఉంటుంది.`
      : `Orders above ${CURRENCY_SYMBOL}${FREE_SHIPPING_THRESHOLD} get free shipping. Orders below that have a shipping charge of ${CURRENCY_SYMBOL}${SHIPPING_COST}.`,
    locale === "te"
      ? "అద్దె ధరలు, డిపాజిట్, మరియు గరిష్ట అద్దె రోజులు ఉత్పత్తి వారీగా మారుతాయి."
      : "Rental price, deposit, and maximum rental days vary by product.",
  ]
    .filter(Boolean)
    .join("\n");

  return createRetrievalDocument({
    sourceType: "store_info",
    sourceKey: `store_info:${locale}:shopping-options`,
    locale,
    title,
    content,
    metadata: {
      href: `${ROUTES.about}#visit-us`,
      page: ROUTES.about,
      sectionKey: "visit-us",
      summaryKind: "shopping-options",
    },
  });
}

function buildFaqDocuments(locale: SupportedPublicLocale) {
  const about = ABOUT_MESSAGES[locale];

  return [1, 2, 3, 4, 5].map((index) => {
    const question = normalizeText(
      about.faq[`q${index}` as keyof typeof about.faq] as string
    );
    const answer = normalizeText(
      about.faq[`a${index}` as keyof typeof about.faq] as string
    );
    const sectionKey = `faq-q${index}`;

    return createRetrievalDocument({
      sourceType: "faq",
      sourceKey: `faq:${locale}:q${index}`,
      locale,
      title: question,
      content: [question, answer].filter(Boolean).join("\n"),
      metadata: {
        href: `${ROUTES.about}#${sectionKey}`,
        page: ROUTES.about,
        sectionKey,
      },
    });
  });
}

function buildTermsDocuments(locale: SupportedPublicLocale) {
  const terms = LEGAL_MESSAGES[locale].terms;

  return TERMS_SECTION_KEYS.map((sectionKey) => {
    const section = terms[sectionKey] as {
      title: string;
      content: string;
      emailLabel?: string;
      phoneLabel?: string;
      addressLabel?: string;
    };
    const contentParts = [terms.title, section.title, section.content];

    if (sectionKey === "contact") {
      contentParts.push(
        `${section.emailLabel}: ${BUSINESS_INFO.email}`,
        `${section.phoneLabel}: ${BUSINESS_INFO.phone}`,
        `${section.addressLabel}: ${BUSINESS_INFO.address.street}, ${BUSINESS_INFO.address.city}, ${BUSINESS_INFO.address.state} ${BUSINESS_INFO.address.pincode}`
      );
    }

    return createRetrievalDocument({
      sourceType: "legal",
      sourceKey: `legal:${locale}:terms:${sectionKey}`,
      locale,
      title: section.title,
      content: contentParts.filter(Boolean).join("\n"),
      metadata: {
        href: `${ROUTES.termsAndConditions}#${sectionKey}`,
        page: ROUTES.termsAndConditions,
        sectionKey,
        legalDocument: "terms",
      },
    });
  });
}

function buildPrivacyDocuments(locale: SupportedPublicLocale) {
  const privacy = LEGAL_MESSAGES[locale].privacy;
  const listDocuments = PRIVACY_LIST_SECTION_KEYS.map(({ key, items }) => {
    const section = privacy[key] as {
      title: string;
      content: string;
      items: Record<string, string>;
    };
    const contentParts = [
      privacy.title,
      section.title,
      section.content,
      ...items.map((item) => section.items[item]),
    ];

    return createRetrievalDocument({
      sourceType: "legal",
      sourceKey: `legal:${locale}:privacy:${key}`,
      locale,
      title: section.title,
      content: contentParts.filter(Boolean).join("\n"),
      metadata: {
        href: `${ROUTES.privacyPolicy}#${key}`,
        page: ROUTES.privacyPolicy,
        sectionKey: key,
        legalDocument: "privacy",
      },
    });
  });

  const textDocuments = PRIVACY_TEXT_SECTION_KEYS.map((key) => {
    const section = privacy[key] as {
      title: string;
      content: string;
      items?: Record<string, string>;
      emailLabel?: string;
      phoneLabel?: string;
      addressLabel?: string;
    };
    const contentParts = [privacy.title, section.title, section.content];

    if (section.items) {
      contentParts.push(...Object.values(section.items).filter(Boolean));
    }

    if (key === "contact") {
      contentParts.push(
        `${section.emailLabel}: ${BUSINESS_INFO.email}`,
        `${section.phoneLabel}: ${BUSINESS_INFO.phone}`,
        `${section.addressLabel}: ${BUSINESS_INFO.address.street}, ${BUSINESS_INFO.address.city}, ${BUSINESS_INFO.address.state} ${BUSINESS_INFO.address.pincode}`
      );
    }

    return createRetrievalDocument({
      sourceType: "legal",
      sourceKey: `legal:${locale}:privacy:${key}`,
      locale,
      title: section.title,
      content: contentParts.filter(Boolean).join("\n"),
      metadata: {
        href: `${ROUTES.privacyPolicy}#${key}`,
        page: ROUTES.privacyPolicy,
        sectionKey: key,
        legalDocument: "privacy",
      },
    });
  });

  return [...listDocuments, ...textDocuments];
}

export const PUBLIC_RETRIEVAL_LOCALES = ["en", "te"] as const;

export function buildPublicRetrievalDocuments(
  products: PublicCatalogSummaryProduct[],
  locales: readonly SupportedPublicLocale[] = PUBLIC_RETRIEVAL_LOCALES
) {
  return locales.flatMap((locale) => [
    buildStoreOverviewDocument(locale),
    buildSiteGuideDocument(locale),
    ...buildStaticRouteDocuments(locale),
    buildMaterialsSummaryDocument(locale, products),
    buildCatalogCoverageDocument(locale, products),
    buildShoppingOptionsDocument(locale, products),
    ...buildFaqDocuments(locale),
    ...buildTermsDocuments(locale),
    ...buildPrivacyDocuments(locale),
  ]);
}
