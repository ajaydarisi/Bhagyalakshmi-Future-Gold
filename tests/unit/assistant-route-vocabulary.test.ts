import { describe, expect, it } from "vitest";
import { MATERIALS, PRODUCT_TAGS } from "@/lib/constants";
import {
  parseAssistantRouteParams,
  serializeAssistantRoute,
} from "@/lib/assistant-route-manifest";

/**
 * The byte-compare invariant in parseAssistantRouteNavigation proves a href was
 * not tampered with; it cannot prove a value means anything. A phrase like
 * "gold bangles for a wedding" as `category` round-trips perfectly and then
 * renders an empty grid, which is the most confidence-destroying way for the
 * "take me to X" flow to fail. These pin the vocabulary checks that stop it.
 */
describe("product filter vocabulary validation", () => {
  it("accepts every real material and tag, including comma-joined multi-selects", () => {
    for (const material of MATERIALS) {
      expect(
        parseAssistantRouteParams("products", { material }),
        material,
      ).toEqual({ material });
    }
    for (const tag of PRODUCT_TAGS) {
      expect(parseAssistantRouteParams("products", { tag }), tag).toEqual({ tag });
    }

    // The deterministic resolver joins multi-selects with "," and the products
    // page splits on it, so a list of known values must survive.
    const joinedMaterials = `${MATERIALS[0]},${MATERIALS[2]}`;
    expect(
      parseAssistantRouteParams("products", { material: joinedMaterials }),
    ).toEqual({ material: joinedMaterials });
  });

  it("rejects material and tag values outside the catalog vocabulary", () => {
    expect(
      parseAssistantRouteParams("products", { material: "Unobtainium" }),
    ).toBeNull();
    expect(parseAssistantRouteParams("products", { tag: "Clearance" })).toBeNull();
    // One bad entry poisons the whole list — otherwise half the filter silently
    // does nothing.
    expect(
      parseAssistantRouteParams("products", {
        material: `${MATERIALS[0]},Unobtainium`,
      }),
    ).toBeNull();
    expect(parseAssistantRouteParams("products", { material: "" })).toBeNull();
  });

  it("rejects a category slug that is not in the live vocabulary", () => {
    const knownCategorySlugs = ["bangles", "necklaces"];

    expect(
      parseAssistantRouteParams(
        "products",
        { category: "bangles" },
        { knownCategorySlugs },
      ),
    ).toEqual({ category: "bangles" });

    expect(
      parseAssistantRouteParams(
        "products",
        { category: "bangles,necklaces" },
        { knownCategorySlugs },
      ),
    ).toEqual({ category: "bangles,necklaces" });

    // The failure this whole task exists for: a model-authored phrase.
    expect(
      parseAssistantRouteParams(
        "products",
        { category: "gold bangles for a wedding" },
        { knownCategorySlugs },
      ),
    ).toBeNull();
    expect(
      parseAssistantRouteParams(
        "products",
        { category: "bangles,tiaras" },
        { knownCategorySlugs },
      ),
    ).toBeNull();
  });

  it("keeps prior behaviour when no category vocabulary is supplied", () => {
    // The client sanitizes without the vocabulary: the server already validated
    // the value and the byte-compare guarantees it is the server's own.
    expect(
      parseAssistantRouteParams("products", { category: "anything-goes" }),
    ).toEqual({ category: "anything-goes" });
  });

  it("fails the whole navigation, not just the parameter, on an unknown category", () => {
    expect(
      serializeAssistantRoute(
        "products",
        { category: "not-a-real-category" },
        { storeMode: "ONLINE", knownCategorySlugs: ["bangles"] },
      ),
    ).toBeNull();

    expect(
      serializeAssistantRoute(
        "products",
        { category: "bangles", sort: "price-asc" },
        { storeMode: "ONLINE", knownCategorySlugs: ["bangles"] },
      ),
    ).toEqual({
      kind: "product_filters",
      destination: "products",
      href: "/products?category=bangles&sort=price-asc",
    });
  });
});
