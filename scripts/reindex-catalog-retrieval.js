#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const APP_NAME = "Bhagyalakshmi Future Gold";
const CURRENCY_SYMBOL = "₹";
const SHIPPING_COST = 49;
const FREE_SHIPPING_THRESHOLD = 999;
const ROUTES = {
  about: "/about",
  products: "/products",
  termsAndConditions: "/terms-and-conditions",
  privacyPolicy: "/privacy-policy",
};

const BUSINESS_INFO = {
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
  hours: {
    weekdays: "10:00 AM – 9:00 PM",
    sunday: "10:00 AM – 2:00 PM",
  },
};

const ABOUT_MESSAGES = {
  en: require("../messages/en/about.json"),
  te: require("../messages/te/about.json"),
};

const LEGAL_MESSAGES = {
  en: require("../messages/en/legal.json"),
  te: require("../messages/te/legal.json"),
};

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
];

const PRIVACY_LIST_SECTION_KEYS = [
  {
    key: "informationWeCollect",
    items: ["account", "google", "shipping", "order", "usage"],
  },
  {
    key: "howWeUse",
    items: ["orders", "account", "communicate", "improve", "security"],
  },
];

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
];

function loadEnvFile(fileName) {
  const envPath = path.resolve(__dirname, "..", fileName);
  if (!fs.existsSync(envPath)) {
    return;
  }

  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex);
    let value = trimmed.slice(eqIndex + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GEMINI_API_KEY",
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error("Missing environment variables:", missing.join(", "));
  process.exit(1);
}

function normalizeText(value) {
  return value ? String(value).trim() : "";
}

function serializeVector(values) {
  return `[${values.join(",")}]`;
}

function buildContentHash({ title, content, metadata }) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ title, content, metadata }))
    .digest("hex");
}

function buildProductDocument(product) {
  const name = normalizeText(product.name);
  const nameTelugu = normalizeText(product.name_telugu);
  const description = normalizeText(product.description);
  const descriptionTelugu = normalizeText(product.description_telugu);
  const categoryName = normalizeText(product.category?.name);
  const categoryNameTelugu = normalizeText(product.category?.name_telugu);
  const categorySlug = normalizeText(product.category?.slug);
  const material = normalizeText(product.material);
  const tags = Array.isArray(product.tags) ? product.tags.filter(Boolean) : [];

  const searchKeywords = [
    name,
    nameTelugu,
    name,
    nameTelugu,
    categoryName,
    categoryNameTelugu,
    categorySlug,
    categoryName,
    categoryNameTelugu,
    material,
    ...tags,
    ...tags,
  ].filter(Boolean);

  const title = [name, nameTelugu].filter(Boolean).join(" / ") || name;
  const priceLine =
    product.is_rental && !product.is_sale
      ? `Rental price ${product.rental_discount_price ?? product.rental_price ?? 0} INR per day`
      : `Sale price ${product.discount_price ?? product.price} INR`;

  const availabilityParts = [
    product.is_sale ? "Available for sale" : null,
    product.is_rental ? "Available for rent" : null,
    product.featured ? "Featured product" : null,
    product.stock > 0 ? `In stock ${product.stock}` : "Out of stock",
    product.set_number ? `Set number ${product.set_number}` : null,
  ].filter(Boolean);

  const content = [
    `Search keywords: ${searchKeywords.join(", ")}`,
    categoryName ? `Category: ${categoryName}` : null,
    categoryNameTelugu ? `Category Telugu: ${categoryNameTelugu}` : null,
    material ? `Material: ${material}` : null,
    tags.length > 0 ? `Tags: ${tags.join(", ")}` : null,
    description ? `Description: ${description}` : null,
    descriptionTelugu ? `Description Telugu: ${descriptionTelugu}` : null,
    priceLine,
    availabilityParts.join(". "),
  ]
    .filter(Boolean)
    .join("\n");

  const metadata = {
    productId: product.id,
    slug: product.slug,
    categorySlug: product.category?.slug ?? null,
    categoryName: product.category?.name ?? null,
    categoryNameTelugu: product.category?.name_telugu ?? null,
    material: product.material ?? null,
    tags,
    isSale: product.is_sale,
    isRental: product.is_rental,
    featured: product.featured,
    stock: product.stock,
    price: product.price,
    discountPrice: product.discount_price,
    rentalPrice: product.rental_price,
    rentalDiscountPrice: product.rental_discount_price,
    rentalDeposit: product.rental_deposit,
    maxRentalDays: product.max_rental_days,
    setNumber: product.set_number,
    href: `/products/${product.slug}`,
  };

  return {
    source_type: "product",
    source_key: `product:${product.id}`,
    product_id: product.id,
    locale: "multi",
    title,
    content,
    metadata,
    content_hash: buildContentHash({ title, content, metadata }),
  };
}

function createPublicDocument({
  sourceType,
  sourceKey,
  locale,
  title,
  content,
  metadata,
}) {
  return {
    source_type: sourceType,
    source_key: sourceKey,
    product_id: null,
    locale,
    title,
    content,
    metadata,
    content_hash: buildContentHash({ title, content, metadata }),
  };
}

function getProductDisplayName(product, locale) {
  if (locale === "te" && product.name_telugu) {
    return product.name_telugu;
  }

  return product.name;
}

function getCategoryDisplayName(category, locale) {
  if (!category) {
    return locale === "te" ? "వర్గీకరించని ఉత్పత్తులు" : "Uncategorised products";
  }

  if (locale === "te" && category.name_telugu) {
    return category.name_telugu;
  }

  return category.name;
}

function buildStoreOverviewDocument(locale) {
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

  return createPublicDocument({
    sourceType: "store_info",
    sourceKey: `store_info:${locale}:overview`,
    locale,
    title:
      locale === "te"
        ? `${APP_NAME} స్టోర్ అవలోకనం`
        : `${APP_NAME} Store Overview`,
    content: [
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
      .join("\n"),
    metadata: {
      href: `${ROUTES.about}#store-info`,
      page: ROUTES.about,
      sectionKey: "store-info",
      summaryKind: "overview",
    },
  });
}

function buildMaterialsSummaryDocument(locale, products) {
  const materialGroups = new Map();

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

  return createPublicDocument({
    sourceType: "store_info",
    sourceKey: `store_info:${locale}:materials`,
    locale,
    title:
      locale === "te"
        ? `${APP_NAME} లో ఉపయోగించే మెటీరియల్స్`
        : `Materials used at ${APP_NAME}`,
    content,
    metadata: {
      href: `${ROUTES.about}#quality-promise`,
      page: ROUTES.about,
      sectionKey: "quality-promise",
      summaryKind: "materials",
    },
  });
}

function buildCatalogCoverageDocument(locale, products) {
  const categoryGroups = new Map();

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

  return createPublicDocument({
    sourceType: "store_info",
    sourceKey: `store_info:${locale}:catalog-coverage`,
    locale,
    title:
      locale === "te"
        ? `${APP_NAME} కాటలాగ్ వర్గాలు మరియు ఉత్పత్తి కవరేజ్`
        : `${APP_NAME} category and product coverage`,
    content,
    metadata: {
      href: ROUTES.products,
      page: ROUTES.products,
      sectionKey: "catalog-coverage",
      summaryKind: "catalog-coverage",
    },
  });
}

function buildShoppingOptionsDocument(locale, products) {
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

  return createPublicDocument({
    sourceType: "store_info",
    sourceKey: `store_info:${locale}:shopping-options`,
    locale,
    title:
      locale === "te"
        ? `${APP_NAME} అమ్మకం, అద్దె మరియు షిప్పింగ్ సారాంశం`
        : `${APP_NAME} sale, rental, and shipping summary`,
    content: [
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
      .join("\n"),
    metadata: {
      href: `${ROUTES.about}#visit-us`,
      page: ROUTES.about,
      sectionKey: "visit-us",
      summaryKind: "shopping-options",
    },
  });
}

function buildFaqDocuments(locale) {
  const about = ABOUT_MESSAGES[locale];

  return [1, 2, 3, 4, 5].map((index) =>
    createPublicDocument({
      sourceType: "faq",
      sourceKey: `faq:${locale}:q${index}`,
      locale,
      title: about.faq[`q${index}`],
      content: `${about.faq[`q${index}`]}\n${about.faq[`a${index}`]}`,
      metadata: {
        href: `${ROUTES.about}#faq-q${index}`,
        page: ROUTES.about,
        sectionKey: `faq-q${index}`,
      },
    })
  );
}

function buildTermsDocuments(locale) {
  const terms = LEGAL_MESSAGES[locale].terms;

  return TERMS_SECTION_KEYS.map((sectionKey) => {
    const section = terms[sectionKey];
    const contentParts = [terms.title, section.title, section.content];

    if (sectionKey === "contact") {
      contentParts.push(
        `${section.emailLabel}: ${BUSINESS_INFO.email}`,
        `${section.phoneLabel}: ${BUSINESS_INFO.phone}`,
        `${section.addressLabel}: ${BUSINESS_INFO.address.street}, ${BUSINESS_INFO.address.city}, ${BUSINESS_INFO.address.state} ${BUSINESS_INFO.address.pincode}`
      );
    }

    return createPublicDocument({
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

function buildPrivacyDocuments(locale) {
  const privacy = LEGAL_MESSAGES[locale].privacy;
  const listDocuments = PRIVACY_LIST_SECTION_KEYS.map(({ key, items }) => {
    const section = privacy[key];
    return createPublicDocument({
      sourceType: "legal",
      sourceKey: `legal:${locale}:privacy:${key}`,
      locale,
      title: section.title,
      content: [
        privacy.title,
        section.title,
        section.content,
        ...items.map((item) => section.items[item]),
      ]
        .filter(Boolean)
        .join("\n"),
      metadata: {
        href: `${ROUTES.privacyPolicy}#${key}`,
        page: ROUTES.privacyPolicy,
        sectionKey: key,
        legalDocument: "privacy",
      },
    });
  });

  const textDocuments = PRIVACY_TEXT_SECTION_KEYS.map((key) => {
    const section = privacy[key];
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

    return createPublicDocument({
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

function buildPublicDocuments(products, locales = ["en", "te"]) {
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

async function syncDocument(admin, ai, document) {
  const { data: existing, error: existingError } = await admin
    .from("catalog_retrieval_documents")
    .select("content_hash, index_status, embedding")
    .eq("source_key", document.source_key)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (
    existing?.content_hash === document.content_hash &&
    existing.index_status === "ready" &&
    existing.embedding
  ) {
    return "skipped";
  }

  const timestamp = new Date().toISOString();
  const priorEmbedding =
    existing?.content_hash === document.content_hash ? existing.embedding : null;

  const { error: upsertError } = await admin.from("catalog_retrieval_documents").upsert(
    {
      ...document,
      embedding: priorEmbedding,
      index_status: "pending",
      last_indexed_at: null,
      last_index_error: null,
      updated_at: timestamp,
    },
    { onConflict: "source_key" }
  );

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  try {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: document.content,
      config: {
        taskType: "RETRIEVAL_DOCUMENT",
        title: document.title,
        outputDimensionality: 768,
      },
    });

    const values = response.embeddings?.[0]?.values;
    if (!values || values.length === 0) {
      throw new Error("No embedding returned");
    }

    const { error: updateError } = await admin
      .from("catalog_retrieval_documents")
      .update({
        embedding: serializeVector(values),
        index_status: "ready",
        last_indexed_at: timestamp,
        last_index_error: null,
        updated_at: timestamp,
      })
      .eq("source_key", document.source_key);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return "ready";
  } catch (embeddingError) {
    const message =
      embeddingError instanceof Error
        ? embeddingError.message
        : "Embedding generation failed";

    await admin
      .from("catalog_retrieval_documents")
      .update({
        embedding: null,
        index_status: "failed",
        last_index_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("source_key", document.source_key);

    console.error(`Failed ${document.source_key}: ${message}`);
    return "failed";
  }
}

async function deleteStaleRows(admin, activeKeys) {
  const { data: existingRows, error } = await admin
    .from("catalog_retrieval_documents")
    .select("source_key, source_type")
    .in("source_type", ["product", "store_info", "faq", "legal"]);

  if (error) {
    throw new Error(error.message);
  }

  const staleKeys = (existingRows ?? [])
    .map((row) => row.source_key)
    .filter((sourceKey) => !activeKeys.has(sourceKey));

  if (staleKeys.length > 0) {
    await admin
      .from("catalog_retrieval_documents")
      .delete()
      .in("source_key", staleKeys);
    console.log(`Deleted ${staleKeys.length} stale retrieval rows.`);
  }
}

async function logPublicDocumentHealth(admin, expectedPublicKeys) {
  const { data: existingRows, error } = await admin
    .from("catalog_retrieval_documents")
    .select("source_key, index_status")
    .in("source_type", ["store_info", "faq", "legal"]);

  if (error) {
    throw new Error(error.message);
  }

  const existingKeys = new Set((existingRows ?? []).map((row) => row.source_key));
  const missingKeys = [...expectedPublicKeys].filter((key) => !existingKeys.has(key));
  const failedKeys = (existingRows ?? [])
    .filter((row) => row.index_status === "failed")
    .map((row) => row.source_key);

  if (missingKeys.length > 0) {
    console.log(`Public docs missing before reindex: ${missingKeys.length}`);
  }

  if (failedKeys.length > 0) {
    console.log(`Public docs failed before reindex: ${failedKeys.length}`);
  }
}

async function main() {
  const [{ createClient }, { GoogleGenAI }] = await Promise.all([
    import("@supabase/supabase-js"),
    import("@google/genai"),
  ]);

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const { data: products, error } = await admin
    .from("products")
    .select("*, category:categories(name, name_telugu, slug)")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const activeProducts = products ?? [];
  const productDocuments = activeProducts.map((product) => buildProductDocument(product));
  const publicDocuments = buildPublicDocuments(activeProducts, ["en", "te"]);
  const expectedPublicKeys = new Set(publicDocuments.map((document) => document.source_key));
  const allDocuments = [...productDocuments, ...publicDocuments];
  const activeKeys = new Set(allDocuments.map((document) => document.source_key));

  await logPublicDocumentHealth(admin, expectedPublicKeys);

  let readyCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const document of allDocuments) {
    const status = await syncDocument(admin, ai, document);

    if (status === "ready") {
      readyCount += 1;
      console.log(`Indexed ${document.source_key}`);
    } else if (status === "failed") {
      failedCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  await deleteStaleRows(admin, activeKeys);

  const { count: finalPublicCount, error: finalPublicCountError } = await admin
    .from("catalog_retrieval_documents")
    .select("id", { count: "exact", head: true })
    .in("source_type", ["store_info", "faq", "legal"]);

  if (finalPublicCountError) {
    throw new Error(finalPublicCountError.message);
  }

  if ((finalPublicCount ?? 0) < expectedPublicKeys.size) {
    console.warn(
      `Public docs are still below the expected count after reindex. Expected ${expectedPublicKeys.size}, found ${finalPublicCount ?? 0}.`
    );
  }

  console.log(
    `Reindex complete. Ready: ${readyCount}. Failed: ${failedCount}. Skipped: ${skippedCount}. Public docs expected: ${expectedPublicKeys.size}.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
