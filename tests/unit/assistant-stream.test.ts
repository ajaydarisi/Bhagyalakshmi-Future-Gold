import { describe, expect, it } from "vitest";
import {
  encodeAssistantStreamEvent,
  readAssistantStream,
} from "@/lib/assistant-stream";
import type { AssistantReply } from "@/types/search";

const reply: AssistantReply = {
  answer: "Grounded answer.",
  citations: [
    {
      sourceType: "faq",
      sourceKey: "faq:en:q1",
      title: "Catalog FAQ",
      href: "/about#faq-q1",
    },
  ],
  followUpSuggestions: [],
  fallbackReason: null,
};

function responseFromFragments(fragments: string[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const fragment of fragments) controller.enqueue(encoder.encode(fragment));
        controller.close();
      },
    }),
    { status: 200 },
  );
}

describe("assistant NDJSON streaming", () => {
  it("handles transport fragmentation and delivers answer deltas before the result", async () => {
    const payload = [
      encodeAssistantStreamEvent({ type: "start" }),
      encodeAssistantStreamEvent({ type: "answer_delta", delta: "Grounded " }),
      encodeAssistantStreamEvent({ type: "answer_delta", delta: "answer." }),
      encodeAssistantStreamEvent({ type: "result", reply, handoff: null }),
    ].join("");
    const seen: string[] = [];

    const result = await readAssistantStream(
      responseFromFragments([payload.slice(0, 17), payload.slice(17, 53), payload.slice(53)]),
      {
        onAnswerDelta(delta) {
          seen.push(`delta:${delta}`);
        },
        onAnswerReset() {
          seen.push("reset");
        },
      },
    );

    expect(seen).toEqual(["delta:Grounded ", "delta:answer."]);
    expect(result.reply).toEqual(reply);
  });

  it("surfaces resets and typed stream errors", async () => {
    const events = [
      encodeAssistantStreamEvent({ type: "answer_delta", delta: "Draft" }),
      encodeAssistantStreamEvent({ type: "answer_reset" }),
      encodeAssistantStreamEvent({ type: "error", message: "Rate limited", status: 429 }),
    ];
    const seen: string[] = [];

    await expect(
      readAssistantStream(responseFromFragments(events), {
        onAnswerDelta: (delta) => seen.push(delta),
        onAnswerReset: () => seen.push("reset"),
      }),
    ).rejects.toThrow("Rate limited (429)");
    expect(seen).toEqual(["Draft", "reset"]);
  });

  it("preserves a validated navigation result only after the final stream event", async () => {
    const navigationReply: AssistantReply = {
      ...reply,
      navigation: {
        kind: "page",
        destination: "terms",
        href: "/terms-and-conditions",
      },
    };
    const payload = [
      encodeAssistantStreamEvent({ type: "answer_delta", delta: "Opening terms." }),
      encodeAssistantStreamEvent({ type: "result", reply: navigationReply, handoff: null }),
    ].join("");
    const seen: string[] = [];

    const result = await readAssistantStream(
      responseFromFragments([payload.slice(0, 24), payload.slice(24)]),
      {
        onAnswerDelta: (delta) => seen.push(delta),
        onAnswerReset() {},
      },
    );

    expect(seen).toEqual(["Opening terms."]);
    expect(result.reply.navigation).toEqual(navigationReply.navigation);
  });

  it("strips malformed navigation from an otherwise valid final result", async () => {
    const unsafeReply = {
      ...reply,
      navigation: {
        kind: "page",
        destination: "terms",
        href: "https://example.com/terms",
      },
    } as AssistantReply;

    const result = await readAssistantStream(
      responseFromFragments([
        encodeAssistantStreamEvent({ type: "result", reply: unsafeReply, handoff: null }),
      ]),
      { onAnswerDelta() {}, onAnswerReset() {} },
    );

    expect(result.reply.navigation).toBeUndefined();
  });

  it("rejects a stream that ends without a final grounded result", async () => {
    await expect(
      readAssistantStream(
        responseFromFragments([
          encodeAssistantStreamEvent({ type: "answer_delta", delta: "Incomplete" }),
        ]),
        { onAnswerDelta() {}, onAnswerReset() {} },
      ),
    ).rejects.toThrow("ended without a result");
  });
});
