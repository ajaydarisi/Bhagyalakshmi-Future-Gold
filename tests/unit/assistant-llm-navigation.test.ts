import { describe, expect, it, vi } from "vitest";
import {
  resolveAssistantLlmNavigation,
  type AssistantLlmNavigationGenerator,
} from "@/lib/assistant-llm-navigation";

function generatorFor(value: unknown) {
  return vi.fn<AssistantLlmNavigationGenerator>().mockResolvedValue(value);
}

describe("assistant LLM navigation fallback", () => {
  it("uses Gemini structured output to select a manifest route, then returns a sanitized navigation", async () => {
    const generator = generatorFor({ routeId: "visit", params: {} });

    await expect(
      resolveAssistantLlmNavigation(
        { query: "Could you direct me to the store directions?", locale: "en" },
        { generateJson: generator },
      ),
    ).resolves.toEqual({
      type: "navigation",
      source: "llm",
      routeId: "visit",
      navigation: {
        kind: "page",
        destination: "visit",
        href: "/visit",
      },
    });

    const [prompt, options] = generator.mock.calls[0] ?? [];
    expect(prompt).toContain("Customer message JSON");
    expect(prompt).not.toContain("/visit");
    expect(options).toMatchObject({
      responseJsonSchema: expect.objectContaining({ anyOf: expect.any(Array) }),
    });
    expect(JSON.stringify(options?.responseJsonSchema)).toContain('"visit"');
    expect(JSON.stringify(options?.responseJsonSchema)).not.toContain("product_detail");
  });

  it("binds only schema-valid typed product-filter parameters", async () => {
    const generator = generatorFor({
      routeId: "products",
      params: {
        type: "sale",
        maxPrice: 2_500,
        material: "Antique",
        q: "earrings",
      },
    });

    await expect(
      resolveAssistantLlmNavigation(
        { query: "Browse antique earrings to buy under 2500", locale: "en" },
        { generateJson: generator },
      ),
    ).resolves.toMatchObject({
      type: "navigation",
      routeId: "products",
      navigation: {
        href: "/products?type=sale&maxPrice=2500&material=Antique&q=earrings",
      },
    });
  });

  it("rejects model attempts to choose entity routes or smuggle arbitrary parameters", async () => {
    const entityGenerator = generatorFor({
      routeId: "product_detail",
      params: { slug: "lotus-necklace" },
    });
    await expect(
      resolveAssistantLlmNavigation(
        { query: "Open the lotus necklace", locale: "en" },
        { generateJson: entityGenerator },
      ),
    ).resolves.toEqual({
      type: "miss",
      source: "llm",
      reason: "invalid_model_output",
    });

    const unsafeParamsGenerator = generatorFor({
      routeId: "terms",
      params: { href: "/admin" },
    });
    await expect(
      resolveAssistantLlmNavigation(
        { query: "Open the terms page", locale: "en" },
        { generateJson: unsafeParamsGenerator },
      ),
    ).resolves.toEqual({
      type: "miss",
      source: "llm",
      reason: "invalid_model_output",
    });
  });

  it("does not spend a model call on ordinary grounded questions and treats null as a safe miss", async () => {
    const generator = generatorFor({ routeId: null, params: {} });

    await expect(
      resolveAssistantLlmNavigation(
        { query: "What are your terms and conditions?", locale: "en" },
        { generateJson: generator },
      ),
    ).resolves.toEqual({
      type: "miss",
      source: "llm",
      reason: "not_navigation",
    });
    expect(generator).not.toHaveBeenCalled();

    await expect(
      resolveAssistantLlmNavigation(
        { query: "Open the admin dashboard", locale: "en" },
        { generateJson: generator },
      ),
    ).resolves.toEqual({
      type: "miss",
      source: "llm",
      reason: "not_navigation",
    });
    expect(generator).not.toHaveBeenCalled();

    await expect(
      resolveAssistantLlmNavigation(
        { query: "Open the policy page", locale: "en" },
        { generateJson: generator },
      ),
    ).resolves.toEqual({
      type: "miss",
      source: "llm",
      reason: "model_miss",
    });
  });

  it("does not invoke Gemini after cancellation", async () => {
    const generator = generatorFor({ routeId: "home", params: {} });
    const controller = new AbortController();
    controller.abort();

    await expect(
      resolveAssistantLlmNavigation(
        { query: "Go home", signal: controller.signal },
        { generateJson: generator },
      ),
    ).resolves.toEqual({
      type: "miss",
      source: "llm",
      reason: "aborted",
    });
    expect(generator).not.toHaveBeenCalled();
  });
});
