import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RetrievedContextItem } from "@/types/search";

const mocks = vi.hoisted(() => ({
  ensurePublicDocuments: vi.fn(),
  generateGroundedReply: vi.fn(),
  getPublicDocumentsByKeys: vi.fn(),
  isLlmNavigationRequest: vi.fn(),
  resolveDynamicNavigation: vi.fn(),
  resolveLlmNavigation: vi.fn(),
  resolvePublicLocales: vi.fn(),
  retrieveCatalogContext: vi.fn(),
}));

vi.mock("@/lib/assistant-navigation-resolver", () => ({
  resolveAssistantDynamicNavigation: mocks.resolveDynamicNavigation,
}));

vi.mock("@/lib/assistant-llm-navigation", () => ({
  isAssistantLlmNavigationRequest: mocks.isLlmNavigationRequest,
  resolveAssistantLlmNavigation: mocks.resolveLlmNavigation,
}));

vi.mock("@/lib/retrieval/catalog", () => ({
  ensurePublicRetrievalDocuments: mocks.ensurePublicDocuments,
  getPublicRetrievalDocumentsByKeys: mocks.getPublicDocumentsByKeys,
  resolvePublicRetrievalLocales: mocks.resolvePublicLocales,
  retrieveCatalogContext: mocks.retrieveCatalogContext,
}));

vi.mock("@/lib/retrieval/answer", () => ({
  generateAssistantGroundedReply: mocks.generateGroundedReply,
}));

import { POST } from "@/app/api/assistant/chat/route";

function assistantRequest(message: string) {
  return new Request("http://localhost/api/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locale: "en",
      source: "text",
      pageContext: { pathname: "/" },
      messages: [{ role: "user", content: message }],
    }),
  });
}

function returnsPolicyItem(): RetrievedContextItem {
  return {
    sourceType: "legal",
    sourceKey: "legal:en:terms:returnsAndExchanges",
    title: "Returns and Exchanges",
    snippet: "Return policy details.",
    locale: "en",
    metadata: { href: "/terms-and-conditions#returnsAndExchanges" },
    href: "/terms-and-conditions#returnsAndExchanges",
    score: 0.9,
  } as RetrievedContextItem;
}

describe("assistant chat navigation fallback tiers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as { __assistantChatRateLimitStore?: unknown })
      .__assistantChatRateLimitStore;
    delete (globalThis as { __assistantPublicDocEnsureStore?: unknown })
      .__assistantPublicDocEnsureStore;

    mocks.resolveDynamicNavigation.mockResolvedValue(null);
    mocks.isLlmNavigationRequest.mockReturnValue(true);
    mocks.ensurePublicDocuments.mockResolvedValue(undefined);
    mocks.getPublicDocumentsByKeys.mockResolvedValue([]);
    mocks.resolvePublicLocales.mockReturnValue(["en"]);
    mocks.retrieveCatalogContext.mockResolvedValue({ items: [] });
  });

  it("returns a manifest-validated LLM route before retrieval", async () => {
    mocks.resolveLlmNavigation.mockResolvedValue({
      type: "navigation",
      source: "llm",
      routeId: "visit",
      navigation: {
        kind: "page",
        destination: "visit",
        href: "/visit",
      },
    });

    const response = await POST(
      assistantRequest("Could you direct me to the store directions?"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      handoff: null,
      reply: {
        navigationResolution: "llm",
        navigation: { destination: "visit", href: "/visit" },
      },
    });
    expect(mocks.retrieveCatalogContext).not.toHaveBeenCalled();
  });

  it("falls through a safe LLM miss to retrieval-grounded policy navigation", async () => {
    mocks.resolveLlmNavigation.mockResolvedValue({
      type: "miss",
      source: "llm",
      reason: "model_miss",
    });
    mocks.retrieveCatalogContext.mockResolvedValue({
      items: [returnsPolicyItem()],
    });

    const response = await POST(
      assistantRequest("Take me to the returns section"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      handoff: null,
      reply: {
        navigationResolution: "grounded",
        navigation: {
          destination: "terms",
          href: "/terms-and-conditions#returnsAndExchanges",
        },
      },
    });
    expect(mocks.generateGroundedReply).not.toHaveBeenCalled();
  });

  it("enforces the LLM fallback deadline when a provider ignores cancellation", async () => {
    vi.useFakeTimers();

    try {
      mocks.resolveLlmNavigation.mockImplementation(
        () => new Promise(() => undefined),
      );
      mocks.retrieveCatalogContext.mockResolvedValue({
        items: [returnsPolicyItem()],
      });

      const responsePromise = POST(
        assistantRequest("Take me to the returns section"),
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(mocks.resolveLlmNavigation).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(3_000);
      const response = await responsePromise;

      expect(mocks.resolveLlmNavigation.mock.calls[0]?.[0]).toMatchObject({
        signal: expect.objectContaining({ aborted: true }),
      });
      await expect(response.json()).resolves.toMatchObject({
        reply: {
          navigationResolution: "grounded",
          navigation: {
            href: "/terms-and-conditions#returnsAndExchanges",
          },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
