import { describe, expect, it } from "vitest";
import { buildAssistantSearchFilters } from "@/lib/assistant";
import {
  isPolicyOrStoreInfoRequest,
  isProductSeekingAssistantRequest,
  selectAssistantRecommendedProducts,
} from "@/lib/assistant-product-recommendations";
import { buildPublicRetrievalDocuments } from "@/lib/retrieval/public-documents";
import { BUSINESS_INFO } from "@/lib/constants";
import type { AssistantReply, RetrievedContextItem } from "@/types/search";

describe("assistant intent routing", () => {
  it("routes owner/about-the-site questions to store info, not product search", () => {
    const storeInfoQueries = [
      "ఈ వెబ్సైట్ కి ఓనర్ ఎవరు?",
      "ఈ సైట్ ఎవరిది?",
      "who is the owner of this website?",
      "who runs this store?",
      "tell me about the shop",
      "do you have a sitemap?",
      "what pages does this website have?",
    ];

    for (const query of storeInfoQueries) {
      expect(isPolicyOrStoreInfoRequest(query), query).toBe(true);
    }
  });

  it("keeps product-seeking queries on the product path", () => {
    const productQueries = [
      "show me wedding earrings",
      "వెడ్డింగ్ సెట్ చూపించండి",
      "cheapest rental necklace under 2000",
    ];

    for (const query of productQueries) {
      expect(isPolicyOrStoreInfoRequest(query), query).toBe(false);
      expect(isProductSeekingAssistantRequest(query), query).toBe(true);
    }
  });
});

describe("assistant budget parsing", () => {
  it("parses spelled-out Telugu and English price limits", () => {
    expect(
      buildAssistantSearchFilters("నాకు ఒక వెయ్యి రూపాయలలో ఏం దొరుకుతాయి ఇక్కడ?")
        ?.maxPrice
    ).toBe(1000);
    expect(
      buildAssistantSearchFilters("రెండు వేల లోపు హారాలు చూపించండి")?.maxPrice
    ).toBe(2000);
    expect(
      buildAssistantSearchFilters("necklaces under two thousand rupees")?.maxPrice
    ).toBe(2000);
    expect(buildAssistantSearchFilters("1000 లోపు సెట్లు")?.maxPrice).toBe(1000);
  });
});

describe("recommended product budget filter", () => {
  function productItem(args: {
    id: string;
    slug: string;
    rentalPrice: number;
  }): RetrievedContextItem {
    return {
      sourceType: "product",
      sourceKey: `product:${args.id}`,
      title: args.slug,
      snippet: "",
      locale: "multi",
      metadata: {},
      productId: args.id,
      slug: args.slug,
      href: `/products/${args.slug}`,
      score: 1,
      hit: {
        id: args.id,
        slug: args.slug,
        name: args.slug,
        name_telugu: null,
        images: [],
        category: null,
        material: null,
        tags: [],
        is_sale: false,
        is_rental: true,
        price: 0,
        discount_price: null,
        rental_price: args.rentalPrice,
        rental_discount_price: null,
        set_number: null,
      } as unknown as NonNullable<RetrievedContextItem["hit"]>,
    };
  }

  it("drops products above the stated budget, including the current page product", () => {
    const cheap = productItem({ id: "p1", slug: "priya-wedding-set", rentalPrice: 699 });
    const expensive = productItem({
      id: "p2",
      slug: "nakshi-gold-wedding-set",
      rentalPrice: 2999,
    });
    const reply: AssistantReply = {
      answer: "…",
      citations: [
        {
          sourceType: "product",
          sourceKey: cheap.sourceKey,
          title: cheap.title,
          productId: "p1",
          slug: cheap.slug,
          href: cheap.href,
        },
      ],
      followUpSuggestions: [],
      fallbackReason: null,
    };

    const recommended = selectAssistantRecommendedProducts({
      latestUserMessage: "నాకు ఒక వెయ్యి రూపాయలలో ఏం దొరుకుతాయి ఇక్కడ?",
      reply,
      retrievedContext: [expensive, cheap],
      pageContext: {
        pathname: "/products/nakshi-gold-wedding-set",
        product: { slug: "nakshi-gold-wedding-set", name: "Nakshi Gold Wedding Set" },
        search: null,
        cart: null,
      },
    });

    expect(recommended.map((product) => product.slug)).toEqual([
      "priya-wedding-set",
    ]);
  });
});

describe("public retrieval documents", () => {
  const documents = buildPublicRetrievalDocuments([]);

  it("grounds the owner in the store overview for both locales", () => {
    for (const locale of ["en", "te"] as const) {
      const overview = documents.find(
        (document) => document.sourceKey === `store_info:${locale}:overview`
      );
      expect(overview?.content).toContain(BUSINESS_INFO.proprietor.name);
    }
  });

  it("includes a site guide document with the main pages for both locales", () => {
    for (const locale of ["en", "te"] as const) {
      const siteGuide = documents.find(
        (document) => document.sourceKey === `store_info:${locale}:site-guide`
      );
      expect(siteGuide).toBeDefined();
      for (const route of ["/products", "/cart", "/checkout", "/about", "/visit"]) {
        expect(siteGuide?.content).toContain(route);
      }
    }
  });
});
