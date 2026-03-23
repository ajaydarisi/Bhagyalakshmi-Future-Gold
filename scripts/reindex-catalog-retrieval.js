#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function loadEnvFile(fileName) {
  const envPath = path.resolve(__dirname, "..", fileName);
  if (!fs.existsSync(envPath)) return;

  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

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
  };

  const contentHash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ title, content, metadata }))
    .digest("hex");

  return {
    source_key: `product:${product.id}`,
    title,
    content,
    metadata,
    content_hash: contentHash,
  };
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

  let readyCount = 0;
  let failedCount = 0;

  for (const product of products ?? []) {
    const document = buildProductDocument(product);
    const timestamp = new Date().toISOString();

    await admin.from("catalog_retrieval_documents").upsert(
      {
        source_type: "product",
        source_key: document.source_key,
        product_id: product.id,
        locale: "multi",
        title: document.title,
        content: document.content,
        metadata: document.metadata,
        content_hash: document.content_hash,
        index_status: "pending",
        last_indexed_at: null,
        last_index_error: null,
        updated_at: timestamp,
      },
      { onConflict: "source_key" }
    );

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

      await admin
        .from("catalog_retrieval_documents")
        .update({
          embedding: serializeVector(values),
          index_status: "ready",
          last_indexed_at: timestamp,
          last_index_error: null,
          updated_at: timestamp,
        })
        .eq("source_key", document.source_key);

      readyCount += 1;
      console.log(`Indexed ${product.slug}`);
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

      failedCount += 1;
      console.error(`Failed ${product.slug}: ${message}`);
    }
  }

  console.log(`Reindex complete. Ready: ${readyCount}. Failed: ${failedCount}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
