import { expect, test } from "@playwright/test";
import {
  buildAssistantProductSearchQuery,
  buildAssistantSearchFilters,
  resolveAssistantQuery,
  shouldPreferAssistantPriceAscending,
} from "../../src/lib/assistant";

test.describe("Assistant retrieval query helpers", () => {
  test("1. Budget purchase prompts derive sale filters and a usable product query", () => {
    expect(buildAssistantSearchFilters("What can I buy under 1000 rupees?")).toEqual({
      maxPrice: 1000,
      type: "sale",
    });
    expect(
      buildAssistantProductSearchQuery({
        latestUserMessage: "What can I buy under 1000 rupees?",
      })
    ).toBe("jewellery");
  });

  test("2. Cheapest rental prompts derive rental search behavior", () => {
    expect(buildAssistantSearchFilters("What is the cheapest rental item?")).toEqual({
      type: "rental",
    });
    expect(shouldPreferAssistantPriceAscending("What is the cheapest rental item?")).toBe(
      true
    );
    expect(
      buildAssistantProductSearchQuery({
        latestUserMessage: "What is the cheapest rental item?",
      })
    ).toBe("rental jewellery");
  });

  test("3. General assistant retrieval query stays keyword-friendly instead of label-heavy", () => {
    expect(
      resolveAssistantQuery({
        messages: [
          {
            role: "user",
            content: "Show me elegant earrings for a wedding",
          },
        ],
        pageContext: {
          pathname: "/",
          product: null,
          search: {
            query: "bridal jewellery",
            categories: ["Earrings"],
          },
          cart: null,
        },
      })
    ).toContain("Show me elegant earrings for a wedding");
    expect(
      resolveAssistantQuery({
        messages: [
          {
            role: "user",
            content: "Show me elegant earrings for a wedding",
          },
        ],
        pageContext: {
          pathname: "/",
          product: null,
          search: null,
          cart: null,
        },
      })
    ).not.toContain("User request:");
  });
});
