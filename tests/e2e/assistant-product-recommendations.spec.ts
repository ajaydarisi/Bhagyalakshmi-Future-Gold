import { expect, test } from "@playwright/test";
import {
  attachAssistantRecommendedProducts,
  selectAssistantRecommendedProducts,
} from "../../src/lib/assistant-product-recommendations";
import type {
  AssistantReply,
  Citation,
  ProductSearchHit,
  RetrievedContextItem,
} from "../../src/types/search";

function buildProductContext(
  index: number,
  overrides: Partial<ProductSearchHit> = {}
): RetrievedContextItem {
  const hit: ProductSearchHit = {
    id: `product-${index}`,
    name: `Product ${index}`,
    name_telugu: `ఉత్పత్తి ${index}`,
    slug: `product-${index}`,
    description: `Description ${index}`,
    description_telugu: `వివరణ ${index}`,
    price: 1000 + index * 100,
    discount_price: 900 + index * 100,
    category_id: "cat-1",
    stock: 10,
    material: "Gold Plated",
    tags: ["bridal", "festival"],
    images: [`https://example.com/product-${index}.jpg`],
    is_active: true,
    featured: false,
    is_sale: true,
    is_rental: index % 2 === 0,
    rental_price: index % 2 === 0 ? 350 + index * 10 : null,
    rental_discount_price: index % 2 === 0 ? 300 + index * 10 : null,
    rental_deposit: null,
    max_rental_days: 7,
    set_number: index,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    category: {
      name: "Earrings",
      name_telugu: "చెవి రింగులు",
      slug: "earrings",
    },
    sourceType: "product",
    sourceKey: `product:product-${index}`,
    retrievalStatus: "ready",
    score: 100 - index,
    keywordRank: index,
    semanticRank: index,
    ...overrides,
  };

  return {
    sourceType: "product",
    sourceKey: hit.sourceKey,
    title: hit.name,
    snippet: hit.description ?? "",
    locale: "multi",
    metadata: {
      slug: hit.slug,
    },
    productId: hit.id,
    slug: hit.slug,
    href: `/products/${hit.slug}`,
    score: hit.score,
    hit,
  };
}

function buildProductCitation(index: number): Citation {
  return {
    sourceType: "product",
    sourceKey: `product:product-${index}`,
    title: `Product ${index}`,
    productId: `product-${index}`,
    slug: `product-${index}`,
    href: `/products/product-${index}`,
  };
}

function buildReply(args?: {
  citations?: Citation[];
  fallbackReason?: AssistantReply["fallbackReason"];
}): AssistantReply {
  return {
    answer: "Here are some grounded recommendations.",
    citations: args?.citations ?? [buildProductCitation(1)],
    followUpSuggestions: [],
    fallbackReason: args?.fallbackReason ?? null,
  };
}

test.describe("Assistant product recommendation helper", () => {
  test("1. Shopping queries attach recommended products and prioritize cited hits", () => {
    const reply = attachAssistantRecommendedProducts({
      latestUserMessage: "Show me bridal earrings under 2000 rupees",
      reply: buildReply({
        citations: [buildProductCitation(2), buildProductCitation(1)],
      }),
      retrievedContext: [
        buildProductContext(1),
        buildProductContext(2),
        buildProductContext(3),
      ],
    });

    expect(reply.recommendedProducts?.map((product) => product.slug)).toEqual([
      "product-2",
      "product-1",
      "product-3",
    ]);
  });

  test("2. Policy or store-info questions stay text-only even when products were retrieved", () => {
    const reply = attachAssistantRecommendedProducts({
      latestUserMessage: "What is your return policy?",
      reply: buildReply({
        citations: [buildProductCitation(1)],
      }),
      retrievedContext: [buildProductContext(1), buildProductContext(2)],
    });

    expect(reply.recommendedProducts).toBeUndefined();
  });

  test("3. Fallback replies never attach product cards", () => {
    const reply = attachAssistantRecommendedProducts({
      latestUserMessage: "Show me necklace sets",
      reply: buildReply({
        citations: [buildProductCitation(1)],
        fallbackReason: "no_context",
      }),
      retrievedContext: [buildProductContext(1), buildProductContext(2)],
    });

    expect(reply.recommendedProducts).toBeUndefined();
  });

  test("4. Current PDP product is pinned first when it is present in retrieved candidates", () => {
    const products = selectAssistantRecommendedProducts({
      latestUserMessage: "How much does this product cost?",
      pageContext: {
        pathname: "/products/product-1",
        product: {
          slug: "product-1",
          name: "Product 1",
        },
        search: null,
        cart: null,
      },
      reply: buildReply({
        citations: [buildProductCitation(2), buildProductCitation(1)],
      }),
      retrievedContext: [
        buildProductContext(2),
        buildProductContext(1),
        buildProductContext(3),
      ],
    });

    expect(products.map((product) => product.slug)).toEqual([
      "product-1",
      "product-2",
      "product-3",
    ]);
  });

  test("5. Recommendations dedupe repeated hits, keep Telugu display data, and cap at three cards", () => {
    const products = selectAssistantRecommendedProducts({
      latestUserMessage: "పెళ్లికి మంచి సెట్లు చూపించండి",
      reply: buildReply({
        citations: [
          buildProductCitation(4),
          buildProductCitation(2),
          buildProductCitation(1),
        ],
      }),
      retrievedContext: [
        buildProductContext(1),
        buildProductContext(2),
        buildProductContext(2, {
          sourceKey: "product:product-2-duplicate",
          score: 40,
        }),
        buildProductContext(3),
        buildProductContext(4),
      ],
    });

    expect(products).toHaveLength(3);
    expect(products.map((product) => product.slug)).toEqual([
      "product-4",
      "product-2",
      "product-1",
    ]);
    expect(products[0]?.name_telugu).toBe("ఉత్పత్తి 4");
    expect(products[0]?.categoryNameTelugu).toBe("చెవి రింగులు");
  });
});
