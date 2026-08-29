import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/assistant/chat/route";

function assistantRequest(args: {
  locale: "en" | "te";
  message: string;
  source?: "text" | "voice";
}) {
  return new Request("http://localhost/api/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locale: args.locale,
      source: args.source ?? "text",
      pageContext: { pathname: "/" },
      messages: [{ role: "user", content: args.message }],
    }),
  });
}

describe("assistant chat navigation short circuit", () => {
  beforeEach(() => {
    delete (globalThis as { __assistantChatRateLimitStore?: unknown })
      .__assistantChatRateLimitStore;
    delete (globalThis as { __assistantPublicDocEnsureStore?: unknown })
      .__assistantPublicDocEnsureStore;
  });

  it("returns a deterministic navigation reply before retrieval or generation", async () => {
    const response = await POST(
      assistantRequest({
        locale: "en",
        message: "Take me to your terms and conditions page",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      handoff: null,
      reply: {
        answer: "Opening terms and conditions.",
        navigation: {
          kind: "page",
          destination: "terms",
          href: "/terms-and-conditions",
        },
      },
    });
  });

  it("uses English for an English command even when the current storefront is Telugu", async () => {
    const response = await POST(
      assistantRequest({
        locale: "te",
        message: "Take me to your privacy policy page",
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      reply: {
        answer: "Opening the privacy policy.",
        navigation: {
          destination: "privacy",
          href: "/privacy-policy",
        },
      },
    });
  });

  it("resolves a voice navigation command before transcript refinement or generation", async () => {
    const response = await POST(
      assistantRequest({
        locale: "en",
        source: "voice",
        message: "nannu terms page ki teesukellandi",
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      reply: {
        answer: expect.stringContaining("నిబంధనలు మరియు షరతుల"),
        navigation: {
          destination: "terms",
          href: "/terms-and-conditions",
        },
      },
    });
  });
});
