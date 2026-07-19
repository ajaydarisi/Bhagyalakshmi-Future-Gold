// Gemini streaming via REST SSE (no SDK needed). Default conversation LLM:
// measured 2026-07-12, sarvam-30b spends 1,100–1,600 unsuppressible reasoning
// tokens (4–6s dead air) per reply; Gemini honors thinkingBudget: 0.
import { env } from "../common/env.js";
import type { ChatMessage, StreamChatOptions } from "./sarvam-llm.js";

export async function streamChatGemini(opts: StreamChatOptions): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const system = opts.messages.find((m) => m.role === "system");
  const turns = opts.messages.filter((m): m is ChatMessage => m.role !== "system");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: { "x-goog-api-key": env("GEMINI_API_KEY"), "content-type": "application/json" },
      body: JSON.stringify({
        ...(system ? { system_instruction: { parts: [{ text: system.content }] } } : {}),
        contents: turns.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          maxOutputTokens: 200,
          temperature: 0.4,
          thinkingConfig: { thinkingBudget: 0 }, // no reasoning dead air
        },
      }),
      signal: opts.signal,
    },
  );

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }

  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk as Uint8Array, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      const text = JSON.parse(payload).candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        full += text;
        opts.onDelta(text);
      }
    }
  }
  return full;
}
