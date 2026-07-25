import { describe, expect, it } from "vitest";
import {
  ASSISTANT_ROUTE_ALLOWED_ANCHORS,
  getAssistantRouteManifestPromptEntries,
  getAssistantRouteManifestPublicEntries,
  parseAssistantRouteNavigation,
  serializeAssistantRoute,
} from "@/lib/assistant-route-manifest";

describe("assistant route manifest", () => {
  it("serializes typed product filters in the established canonical order", () => {
    expect(
      serializeAssistantRoute("products", {
        type: "rental",
        minPrice: 1_000,
        maxPrice: 3_000,
        tag: "New",
        material: "Gold Plated",
        category: "necklaces",
        sort: "price-asc",
        page: 2,
        q: "bridal set",
      }),
    ).toEqual({
      kind: "product_filters",
      destination: "products",
      href: "/products?type=rental&minPrice=1000&maxPrice=3000&tag=New&material=Gold+Plated&category=necklaces&sort=price-asc&page=2&q=bridal+set",
    });

    expect(
      serializeAssistantRoute("products", { minPrice: 3_000, maxPrice: 1_000 }),
    ).toBeNull();
    expect(
      serializeAssistantRoute("products", { redirect: "/admin" }),
    ).toBeNull();
  });

  it("authorizes only manifest-owned policy and about anchors", () => {
    expect(ASSISTANT_ROUTE_ALLOWED_ANCHORS.terms).toContain("returnsAndExchanges");
    expect(
      serializeAssistantRoute("terms", { anchor: "returnsAndExchanges" }),
    ).toEqual({
      kind: "page",
      destination: "terms",
      href: "/terms-and-conditions#returnsAndExchanges",
    });
    expect(serializeAssistantRoute("terms", { anchor: "redirect" })).toBeNull();
  });

  it("round-trips only canonical manifest navigation", () => {
    expect(
      parseAssistantRouteNavigation({
        kind: "product_filters",
        destination: "products",
        href: "/products?type=sale&maxPrice=2000&tag=Trending&q=earrings",
      }),
    ).toEqual({
      routeId: "products",
      params: {
        type: "sale",
        maxPrice: 2_000,
        tag: "Trending",
        q: "earrings",
      },
    });

    expect(
      parseAssistantRouteNavigation({
        kind: "page",
        destination: "terms",
        href: "/terms-and-conditions#returnsAndExchanges",
      }),
    ).toEqual({
      routeId: "terms",
      params: { anchor: "returnsAndExchanges" },
    });

    expect(
      parseAssistantRouteNavigation({
        kind: "page",
        destination: "terms",
        href: "/terms-and-conditions#not-allowed",
      }),
    ).toBeNull();
    expect(
      parseAssistantRouteNavigation({
        kind: "product_filters",
        destination: "products",
        href: "/products?redirect=%2Fadmin",
      }),
    ).toBeNull();
  });

  it("keeps server-resolved entities out of the LLM route menu while exposing typed public metadata", () => {
    const promptRouteIds = getAssistantRouteManifestPromptEntries({ locale: "en" }).map(
      (route) => route.routeId,
    );
    expect(promptRouteIds).toContain("products");
    expect(promptRouteIds).not.toContain("product_detail");
    expect(promptRouteIds).not.toContain("order_detail");

    const productDetail = getAssistantRouteManifestPublicEntries().find(
      (route) => route.id === "product_detail",
    );
    expect(productDetail).toMatchObject({
      entityResolution: "product",
      llmEnabled: false,
      paramsSchema: expect.objectContaining({ type: "object" }),
    });
  });
});
