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

  const content = [
    `${about.label}: ${about.tagline}`,
    about.mission,
    about.storyShort,
    about.qualityProcess,
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
    buildMaterialsSummaryDocument(locale, products),
    buildCatalogCoverageDocument(locale, products),
    buildShoppingOptionsDocument(locale, products),
    ...buildFaqDocuments(locale),
    ...buildTermsDocuments(locale),
    ...buildPrivacyDocuments(locale),
  ]);
}
