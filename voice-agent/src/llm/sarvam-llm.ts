// Sarvam chat completions (OpenAI-compatible SSE). Verified 2026-07-12:
// POST https://api.sarvam.ai/v1/chat/completions, models sarvam-30b / sarvam-105b.
// Cancellation = AbortController on the fetch, same as the old Claude design.
import { env } from "../common/env.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamChatOptions {
  messages: ChatMessage[];
  signal?: AbortSignal;
  onDelta: (text: string) => void;
  /** Fires once when reasoning tokens start streaming (before any content). */
  onReasoningStart?: () => void;
}

export async function streamChat(opts: StreamChatOptions): Promise<string> {
  const res = await fetch("https://api.sarvam.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "api-subscription-key": env("SARVAM_API_KEY"),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.SARVAM_LLM_MODEL || "sarvam-30b",
      messages: opts.messages,
      stream: true,
      // Observed 2026-07-12: sarvam-30b ALWAYS streams reasoning_content first
      // (enable_thinking:false not honored). Budget must cover reasoning +
      // reply or content never arrives; reasoning deltas are skipped below.
      max_tokens: 800,
      temperature: 0.2,
      reasoning_effort: "low",
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Sarvam LLM HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }

  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  let reasoningSeen = false;
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk as Uint8Array, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return full;
      const delta = JSON.parse(payload).choices?.[0]?.delta ?? {};
      if (delta.reasoning_content && !reasoningSeen) {
        reasoningSeen = true;
        opts.onReasoningStart?.();
      }
      if (delta.content) {
        full += delta.content;
        opts.onDelta(delta.content);
      }
    }
  }
  return full;
}
