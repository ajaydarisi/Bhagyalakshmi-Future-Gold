import { describe, expect, it } from "vitest";
import {
  resolveAssistantDynamicNavigationIntent,
  resolveAssistantNavigation,
  sanitizeAssistantNavigation,
  sanitizeAssistantNavigationOptions,
} from "@/lib/assistant-navigation";

describe("deterministic assistant navigation", () => {
  it("routes explicit English, Telugu, and Romanized Telugu legal commands", () => {
    for (const query of [
      "Take me to your terms and conditions page",
      "నన్ను నిబంధనలు పేజీకి తీసుకెళ్లండి",
      "nannu terms page ki teesukellandi",
    ]) {
      expect(resolveAssistantNavigation(query), query).toEqual({
        kind: "page",
        destination: "terms",
        href: "/terms-and-conditions",
      });
    }
  });

  it("keeps a question about a policy on the grounded-answer path", () => {
    expect(resolveAssistantNavigation("What are your terms and conditions?")).toBeNull();
    expect(
      resolveAssistantNavigation("Tell me about your shipping and delivery terms."),
    ).toBeNull();
  });

  it("treats 'show me' as a page navigation command", () => {
    const cases = [
      ["Show me Terms and Conditions", "terms", "/terms-and-conditions"],
      ["Show me the privacy policy", "privacy", "/privacy-policy"],
      ["Show me my orders", "orders", "/account/orders"],
      ["నిబంధనలు చూపించండి", "terms", "/terms-and-conditions"],
      ["terms chupinchandi", "terms", "/terms-and-conditions"],
    ] as const;
    for (const [query, destination, href] of cases) {
      expect(resolveAssistantNavigation(query), query).toEqual({
        kind: "page",
        destination,
        href,
      });
    }
    expect(resolveAssistantNavigation("Show me the admin dashboard")).toBeNull();
  });

  it("does not confuse ordinary questions with explicit navigation commands", () => {
    expect(
      resolveAssistantNavigation("Is the store open today? What are your terms and conditions?"),
    ).toBeNull();
    expect(
      resolveAssistantNavigation("Can I go to checkout after applying a coupon?"),
    ).toBeNull();
  });

  it("routes every static customer page, including auth recovery, but never admin", () => {
    const routes = [
      ["Go to home", "home", "/"],
      ["Go to search", "search", "/search"],
      ["Open my cart", "cart", "/cart"],
      ["Open checkout", "checkout", "/checkout"],
      ["Open my wishlist", "wishlist", "/wishlist"],
      ["Go to my account", "account", "/account"],
      ["Go to my orders", "orders", "/account/orders"],
      ["Open saved addresses", "addresses", "/account/addresses"],
      ["Open about us", "about", "/about"],
      ["Open store location", "visit", "/visit"],
      ["Take me to the login page", "login", "/login"],
      ["Open sign up", "signup", "/signup"],
      ["Reset my password", "forgot_password", "/forgot-password"],
    ] as const;

    for (const [query, destination, href] of routes) {
      expect(resolveAssistantNavigation(query), query).toEqual({
        kind: "page",
        destination,
        href,
      });
    }
    expect(resolveAssistantNavigation("Take me to the admin dashboard")).toBeNull();
  });

  it("recognises concise English and Romanized Telugu page commands", () => {
    expect(resolveAssistantNavigation("Go to search")).toEqual({
      kind: "page",
      destination: "search",
      href: "/search",
    });
    expect(resolveAssistantNavigation("terms page ki vellandi")).toEqual({
      kind: "page",
      destination: "terms",
      href: "/terms-and-conditions",
    });
  });

  it("builds the requested rental-first budget URL", () => {
    expect(resolveAssistantNavigation("Show me products that are under 1000")).toEqual({
      kind: "product_filters",
      destination: "products",
      href: "/products?type=rental&maxPrice=1000",
    });
  });

  it("preserves product wording and lets explicit sale or rental intent override the default", () => {
    expect(resolveAssistantNavigation("Show me earrings under 1000")).toEqual({
      kind: "product_filters",
      destination: "products",
      href: "/products?type=rental&maxPrice=1000&q=earrings",
    });
    expect(resolveAssistantNavigation("Show me products to buy under 1000")).toEqual({
      kind: "product_filters",
      destination: "products",
      href: "/products?type=sale&maxPrice=1000",
    });
    expect(resolveAssistantNavigation("Show me sale products under 1000")).toEqual({
      kind: "product_filters",
      destination: "products",
      href: "/products?type=sale&maxPrice=1000",
    });
    expect(resolveAssistantNavigation("Show me rental products under 1000")).toEqual({
      kind: "product_filters",
      destination: "products",
      href: "/products?type=rental&maxPrice=1000",
    });
  });

  it("maps tag phrases to the canonical tag filter instead of free-text q", () => {
    const cases = [
      ["Show me trending products", "/products?tag=Trending"],
      ["Show me new arrivals", "/products?tag=New"],
      ["Show me best seller products", "/products?tag=Best+Seller"],
      ["Show me limited edition jewellery", "/products?tag=Limited+Edition"],
      ["ట్రెండింగ్ ఉత్పత్తులు చూపించండి", "/products?tag=Trending"],
      ["Show me trending products under 1000", "/products?type=rental&maxPrice=1000&tag=Trending"],
    ] as const;
    for (const [query, href] of cases) {
      expect(resolveAssistantNavigation(query), query).toEqual({
        kind: "product_filters",
        destination: "products",
        href,
      });
    }
  });

  it("maps material phrases to the canonical material filter", () => {
    const cases = [
      ["Show me gold plated jewellery", "/products?material=Gold+Plated"],
      ["Show me antique jewellery", "/products?material=Antique"],
      ["Show me CZ products", "/products?material=CZ"],
      ["గోల్డ్ ప్లేటెడ్ నగలు చూపించండి", "/products?material=Gold+Plated"],
    ] as const;
    for (const [query, href] of cases) {
      expect(resolveAssistantNavigation(query), query).toEqual({
        kind: "product_filters",
        destination: "products",
        href,
      });
    }
  });

  it("extracts minimum prices and price ranges", () => {
    expect(resolveAssistantNavigation("Show me products above 2000")).toEqual({
      kind: "product_filters",
      destination: "products",
      href: "/products?minPrice=2000",
    });
    expect(resolveAssistantNavigation("Show me products between 1000 and 5000")).toEqual({
      kind: "product_filters",
      destination: "products",
      href: "/products?type=rental&minPrice=1000&maxPrice=5000",
    });
    expect(
      resolveAssistantNavigation("1000 నుండి 5000 వరకు ఉత్పత్తులు చూపించండి"),
    ).toEqual({
      kind: "product_filters",
      destination: "products",
      href: "/products?type=rental&minPrice=1000&maxPrice=5000",
    });
  });

  it("sorts by ascending price on explicit cheapness cues only", () => {
    expect(resolveAssistantNavigation("Show me the cheapest products")).toEqual({
      kind: "product_filters",
      destination: "products",
      href: "/products?sort=price-asc",
    });
    // A plain budget cap keeps the default sort.
    expect(
      resolveAssistantNavigation("Show me products that are under 1000")?.href,
    ).toBe("/products?type=rental&maxPrice=1000");
  });

  it("keeps navigation verbs and page filler out of the q parameter", () => {
    expect(resolveAssistantNavigation("Take me to the products page")).toEqual({
      kind: "product_filters",
      destination: "products",
      href: "/products",
    });
    expect(resolveAssistantNavigation("Take me to the necklace collection")).toEqual({
      kind: "product_filters",
      destination: "products",
      href: "/products?q=necklace",
    });
  });

  it("combines tag, material, price, and residual q in one URL", () => {
    expect(
      resolveAssistantNavigation("Show me new gold plated bangles under 3000"),
    ).toEqual({
      kind: "product_filters",
      destination: "products",
      href: "/products?type=rental&maxPrice=3000&tag=New&material=Gold+Plated&q=bangles",
    });
  });

  it("recognises detail intent without confusing it with list navigation", () => {
    expect(resolveAssistantDynamicNavigationIntent("Open product Lotus Necklace")).toEqual({
      type: "product",
      query: "Lotus Necklace",
    });
    expect(resolveAssistantDynamicNavigationIntent("Open set number 42")).toEqual({
      type: "product",
      query: "set number 42",
    });
    expect(resolveAssistantDynamicNavigationIntent("Open my order SC-ABC-1234")).toEqual({
      type: "order",
      orderReference: "SC-ABC-1234",
    });
    expect(resolveAssistantDynamicNavigationIntent("Open my latest order")).toEqual({
      type: "order",
      orderReference: "latest",
    });
    expect(
      resolveAssistantDynamicNavigationIntent("Open order confirmation for SC-ABC-1234"),
    ).toEqual({
      type: "confirmation",
      orderReference: "SC-ABC-1234",
    });
    expect(resolveAssistantDynamicNavigationIntent("Open my orders")).toBeNull();
    expect(resolveAssistantNavigation("Open my orders")).toEqual({
      kind: "page",
      destination: "orders",
      href: "/account/orders",
    });
  });
});

describe("assistant navigation transport validation", () => {
  it("accepts only allow-listed logical customer hrefs", () => {
    expect(
      sanitizeAssistantNavigation({
        kind: "page",
        destination: "privacy",
        href: "/privacy-policy",
      }),
    ).toEqual({
      kind: "page",
      destination: "privacy",
      href: "/privacy-policy",
    });
    expect(
      sanitizeAssistantNavigation({
        kind: "product_detail",
        destination: "product_detail",
        href: "/products/lotus-necklace",
      }),
    ).toEqual({
      kind: "product_detail",
      destination: "product_detail",
      href: "/products/lotus-necklace",
    });
    expect(
      sanitizeAssistantNavigation({
        kind: "order_detail",
        destination: "order_detail",
        href: "/account/orders/123e4567-e89b-12d3-a456-426614174000",
      }),
    ).toEqual({
      kind: "order_detail",
      destination: "order_detail",
      href: "/account/orders/123e4567-e89b-12d3-a456-426614174000",
    });
    expect(
      sanitizeAssistantNavigation({
        kind: "checkout_confirmation",
        destination: "checkout_confirmation",
        href: "/checkout/confirmation?order_id=123e4567-e89b-12d3-a456-426614174000",
      }),
    ).toEqual({
      kind: "checkout_confirmation",
      destination: "checkout_confirmation",
      href: "/checkout/confirmation?order_id=123e4567-e89b-12d3-a456-426614174000",
    });
    expect(
      sanitizeAssistantNavigation({
        kind: "product_filters",
        destination: "products",
        href: "/products?type=rental&maxPrice=1000",
      }),
    ).toEqual({
      kind: "product_filters",
      destination: "products",
      href: "/products?type=rental&maxPrice=1000",
    });
  });

  it("rejects external, admin, traversal, and arbitrary query destinations", () => {
    for (const navigation of [
      {
        kind: "page",
        destination: "terms",
        href: "https://example.com/terms",
      },
      {
        kind: "page",
        destination: "terms",
        href: "//example.com/terms",
      },
      {
        kind: "page",
        destination: "admin",
        href: "/admin",
      },
      {
        kind: "product_filters",
        destination: "products",
        href: "/products?redirect=/admin",
      },
      {
        kind: "product_filters",
        destination: "products",
        href: "/products?type=admin&maxPrice=Infinity&page=-1",
      },
      {
        kind: "product_filters",
        destination: "products",
        href: "/products?type=sale&type=rental",
      },
      {
        kind: "product_filters",
        destination: "products",
        href: "/products/../admin",
      },
      {
        kind: "order_detail",
        destination: "order_detail",
        href: "/account/orders/not-a-uuid",
      },
      {
        kind: "checkout_confirmation",
        destination: "checkout_confirmation",
        href: "/checkout/confirmation?order_id=123e4567-e89b-12d3-a456-426614174000&redirect=/admin",
      },
    ]) {
      expect(sanitizeAssistantNavigation(navigation), JSON.stringify(navigation)).toBeNull();
    }
  });

  it("keeps only bounded, validated choice destinations", () => {
    expect(
      sanitizeAssistantNavigationOptions([
        {
          id: "product:1",
          label: "Lotus Necklace",
          description: "Set number 42",
          navigation: {
            kind: "product_detail",
            destination: "product_detail",
            href: "/products/lotus-necklace",
          },
        },
        {
          id: "unsafe",
          label: "Admin",
          navigation: {
            kind: "page",
            destination: "admin",
            href: "/admin",
          },
        },
      ]),
    ).toEqual([
      {
        id: "product:1",
        label: "Lotus Necklace",
        description: "Set number 42",
        navigation: {
          kind: "product_detail",
          destination: "product_detail",
          href: "/products/lotus-necklace",
        },
      },
    ]);
  });
});
