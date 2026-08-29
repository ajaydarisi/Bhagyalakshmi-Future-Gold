import { describe, expect, it } from "vitest";
import {
  ASSISTANT_GROUNDED_NAVIGATION_ALLOWED_ANCHORS,
  buildAssistantGroundedNavigationCandidates,
  resolveAssistantGroundedNavigation,
} from "@/lib/assistant-navigation-grounding";
import { buildPublicRetrievalDocuments } from "@/lib/retrieval/public-documents";
import type { RetrievedContextItem } from "@/types/search";

function productItem(overrides: Partial<RetrievedContextItem> = {}) {
  return {
    sourceType: "product",
    sourceKey: "product:lotus-necklace",
    title: "Lotus Necklace",
    snippet: "A lotus-inspired necklace.",
    locale: "multi",
    metadata: {},
    productId: "product-1",
    slug: "lotus-necklace",
    href: "/products/lotus-necklace",
    score: 0.9,
    hit: {
      id: "product-1",
      name: "Lotus Necklace",
      name_telugu: "లోటస్ నెక్లెస్",
      slug: "lotus-necklace",
      category: {
        name: "Necklaces",
        name_telugu: "హారాలు",
        slug: "necklaces",
      },
    },
    ...overrides,
  } as RetrievedContextItem;
}

function legalItem(overrides: Partial<RetrievedContextItem> = {}) {
  return {
    sourceType: "legal",
    sourceKey: "legal:en:terms:returnsAndExchanges",
    title: "Returns and Exchanges",
    snippet: "Return policy details.",
    locale: "en",
    metadata: {
      href: "/terms-and-conditions#returnsAndExchanges",
    },
    href: "/terms-and-conditions#returnsAndExchanges",
    score: 0.8,
    ...overrides,
  } as RetrievedContextItem;
}

describe("assistant grounded navigation", () => {
  it("indexes concise bilingual documents for every supported static customer route", () => {
    const documents = buildPublicRetrievalDocuments([], ["en", "te"]);

    expect(documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "store_info:en:route:visit",
          sourceType: "store_info",
          metadata: expect.objectContaining({ href: "/visit", routeId: "visit" }),
        }),
        expect.objectContaining({
          sourceKey: "store_info:te:route:privacy",
          sourceType: "store_info",
          metadata: expect.objectContaining({
            href: "/privacy-policy",
            routeId: "privacy",
          }),
        }),
      ]),
    );
  });

  it("only turns an explicit retrieved product slug into its canonical detail route", () => {
    const context = [productItem()];
    const candidates = buildAssistantGroundedNavigationCandidates({
      query: "Open the Lotus Necklace",
      locale: "en",
      retrievedContext: context,
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        id: "product:lotus-necklace",
        type: "product",
        navigation: {
          kind: "product_detail",
          destination: "product_detail",
          href: "/products/lotus-necklace",
        },
      }),
    ]);

    const result = resolveAssistantGroundedNavigation({
      query: "Open the Lotus Necklace",
      locale: "en",
      retrievedContext: context,
      // A structured model may send extra fields, but the resolver only reads
      // the candidate ID and never a model-provided href.
      selection: {
        candidateId: "product:lotus-necklace",
        href: "/admin",
      } as unknown as { candidateId: string | null },
    });

    expect(result).toMatchObject({
      type: "navigation",
      navigation: { href: "/products/lotus-necklace" },
    });
  });

  it("offers a category only when the retrieved category is actually named in the request", () => {
    const context = [productItem()];
    const candidates = buildAssistantGroundedNavigationCandidates({
      query: "Show the necklaces category",
      locale: "en",
      retrievedContext: context,
    });

    expect(candidates.map((candidate) => candidate.id)).toContain("category:necklaces");

    const result = resolveAssistantGroundedNavigation({
      query: "Show the necklaces category",
      locale: "en",
      retrievedContext: context,
      selection: { candidateId: "category:necklaces" },
    });

    expect(result).toMatchObject({
      type: "navigation",
      navigation: {
        kind: "product_filters",
        destination: "products",
        href: "/products?category=necklaces",
      },
    });
  });

  it("grounds a policy section through the manifest-owned allow-listed anchor", () => {
    const result = resolveAssistantGroundedNavigation({
      query: "Take me to the returns section",
      locale: "en",
      retrievedContext: [legalItem()],
    });

    expect(ASSISTANT_GROUNDED_NAVIGATION_ALLOWED_ANCHORS.terms).toContain(
      "returnsAndExchanges",
    );
    expect(result).toMatchObject({
      type: "navigation",
      navigation: {
        kind: "page",
        destination: "terms",
        href: "/terms-and-conditions#returnsAndExchanges",
      },
    });
  });

  it("keeps multiple product matches as existing choice chips and rejects invalid document targets", () => {
    const context = [
      productItem(),
      productItem({
        sourceKey: "product:temple-necklace",
        title: "Temple Necklace",
        productId: "product-2",
        slug: "temple-necklace",
        href: "/products/temple-necklace",
        hit: {
          id: "product-2",
          name: "Temple Necklace",
          name_telugu: null,
          slug: "temple-necklace",
          category: {
            name: "Necklaces",
            name_telugu: "హారాలు",
            slug: "necklaces",
          },
        } as unknown as RetrievedContextItem["hit"],
      }),
    ];

    expect(
      resolveAssistantGroundedNavigation({
        query: "Open a necklace product",
        locale: "en",
        retrievedContext: context,
      }),
    ).toMatchObject({
      type: "options",
      options: [
        expect.objectContaining({
          navigation: expect.objectContaining({ href: "/products/lotus-necklace" }),
        }),
        expect.objectContaining({
          navigation: expect.objectContaining({ href: "/products/temple-necklace" }),
        }),
      ],
    });

    expect(
      resolveAssistantGroundedNavigation({
        query: "Open the policy",
        locale: "en",
        retrievedContext: [
          legalItem({
            href: "https://example.com/terms",
            metadata: { href: "https://example.com/terms" },
          }),
        ],
      }),
    ).toBeNull();

    expect(
      resolveAssistantGroundedNavigation({
        query: "Open the policy",
        locale: "en",
        retrievedContext: [
          legalItem({
            href: "/%2e%2e",
            metadata: { href: "/%2e%2e" },
          }),
        ],
      }),
    ).toBeNull();
  });

  it("treats an explicit null model choice as no navigation", () => {
    expect(
      resolveAssistantGroundedNavigation({
        query: "Open the Lotus Necklace",
        locale: "en",
        retrievedContext: [productItem()],
        selection: null,
      }),
    ).toBeNull();
  });

  it("does not navigate from generic seed context without a request match", () => {
    const genericStoreSeed = {
      sourceType: "store_info",
      sourceKey: "store_info:en:overview",
      title: "Bhagyalakshmi Future Gold Store Overview",
      snippet: "Store information and opening hours.",
      locale: "en",
      metadata: { href: "/about" },
      href: "/about",
    } as RetrievedContextItem;

    expect(
      resolveAssistantGroundedNavigation({
        query: "Take me somewhere",
        locale: "en",
        retrievedContext: [genericStoreSeed],
      }),
    ).toBeNull();
  });

  it("allows a safely matched current product when the request uses a pronoun", () => {
    expect(
      resolveAssistantGroundedNavigation({
        query: "Open it",
        locale: "en",
        retrievedContext: [productItem()],
        pageContext: {
          pathname: "/products/lotus-necklace",
          product: { slug: "lotus-necklace", name: "Lotus Necklace" },
        },
      }),
    ).toMatchObject({
      type: "navigation",
      navigation: { href: "/products/lotus-necklace" },
    });
  });
});
