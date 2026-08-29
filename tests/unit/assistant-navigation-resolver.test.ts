import { describe, expect, it, vi } from "vitest";
import {
  resolveAssistantDynamicNavigation,
  type AssistantDynamicNavigationDependencies,
} from "@/lib/assistant-navigation-resolver";

const PRODUCT = {
  id: "product-1",
  slug: "lotus-necklace",
  name: "Lotus Necklace",
  name_telugu: "లోటస్ నెక్లెస్",
  set_number: 42,
};
const ORDER = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  order_number: "SC-ABC-1234",
  created_at: "2026-07-18T10:00:00.000Z",
};

function dependencies(
  overrides: AssistantDynamicNavigationDependencies = {},
): AssistantDynamicNavigationDependencies {
  return {
    findExactProductMatches: async () => [],
    findProductCandidates: async () => [],
    getAuthenticatedUser: async () => ({ id: "customer-1" }),
    findOwnedOrder: async () => null,
    findRecentOwnedOrders: async () => [],
    ...overrides,
  };
}

describe("dynamic assistant navigation resolver", () => {
  it("opens a uniquely matched active product", async () => {
    const result = await resolveAssistantDynamicNavigation(
      { query: "Open product Lotus Necklace", locale: "en" },
      dependencies({ findExactProductMatches: async () => [PRODUCT] }),
    );

    expect(result).toEqual({
      type: "navigation",
      navigation: {
        kind: "product_detail",
        destination: "product_detail",
        href: "/products/lotus-necklace",
      },
    });
  });

  it("returns safe product choices rather than guessing between matches", async () => {
    const result = await resolveAssistantDynamicNavigation(
      { query: "Open product necklace", locale: "te" },
      dependencies({
        findProductCandidates: async () => [
          PRODUCT,
          { ...PRODUCT, id: "product-2", slug: "temple-necklace", set_number: 43 },
        ],
      }),
    );

    expect(result).toMatchObject({
      type: "options",
      optionType: "product",
      options: [
        {
          id: "product:product-1",
          label: "లోటస్ నెక్లెస్",
          navigation: { href: "/products/lotus-necklace" },
        },
        {
          id: "product:product-2",
          navigation: { href: "/products/temple-necklace" },
        },
      ],
    });
  });

  it("uses only an owned order for detail and confirmation navigation", async () => {
    const owned = dependencies({ findOwnedOrder: async () => ORDER });

    await expect(
      resolveAssistantDynamicNavigation(
        { query: "Open my order SC-ABC-1234", locale: "en" },
        owned,
      ),
    ).resolves.toEqual({
      type: "navigation",
      navigation: {
        kind: "order_detail",
        destination: "order_detail",
        href: `/account/orders/${ORDER.id}`,
      },
    });

    await expect(
      resolveAssistantDynamicNavigation(
        { query: "Open order confirmation for SC-ABC-1234", locale: "en" },
        owned,
      ),
    ).resolves.toEqual({
      type: "navigation",
      navigation: {
        kind: "checkout_confirmation",
        destination: "checkout_confirmation",
        href: `/checkout/confirmation?order_id=${ORDER.id}`,
      },
    });
  });

  it("falls back safely for unowned, anonymous, and context-free confirmation requests", async () => {
    await expect(
      resolveAssistantDynamicNavigation(
        { query: "Open my order SC-ABC-1234", locale: "en" },
        dependencies(),
      ),
    ).resolves.toEqual({
      type: "navigation",
      navigation: {
        kind: "page",
        destination: "orders",
        href: "/account/orders",
      },
      noMatchingOrder: true,
    });

    await expect(
      resolveAssistantDynamicNavigation(
        { query: "Open my order SC-ABC-1234", locale: "en" },
        dependencies({ getAuthenticatedUser: async () => null }),
      ),
    ).resolves.toEqual({
      type: "navigation",
      navigation: {
        kind: "page",
        destination: "orders",
        href: "/account/orders",
      },
    });

    await expect(
      resolveAssistantDynamicNavigation(
        { query: "Open order confirmation", locale: "en" },
        dependencies(),
      ),
    ).resolves.toEqual({
      type: "navigation",
      navigation: {
        kind: "page",
        destination: "orders",
        href: "/account/orders",
      },
    });
  });

  it("offers recent owned orders for an ambiguous order-detail request", async () => {
    const result = await resolveAssistantDynamicNavigation(
      { query: "Open my order", locale: "en" },
      dependencies({ findRecentOwnedOrders: async () => [ORDER] }),
    );

    expect(result).toMatchObject({
      type: "options",
      optionType: "order",
      options: [
        {
          id: `order:${ORDER.id}`,
          label: `Order ${ORDER.order_number}`,
          navigation: { href: `/account/orders/${ORDER.id}` },
        },
      ],
    });
  });

  it("drops invalid dynamic entity values rather than bypassing manifest serialization", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      resolveAssistantDynamicNavigation(
        { query: "Open product invalid", locale: "en" },
        dependencies({
          findExactProductMatches: async () => [{ ...PRODUCT, slug: "not a valid slug" }],
        }),
      ),
    ).resolves.toBeNull();

    expect(consoleError).toHaveBeenCalledWith(
      "[assistant.navigation] Failed to resolve dynamic target",
      expect.any(Error),
    );
  });
});
