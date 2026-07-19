// Conversation LLM selector. Default gemini — see gemini-llm.ts header for the
// measured reason. Flip back with LLM_PROVIDER=sarvam if Sarvam ships no-think.
import { streamChatGemini } from "./gemini-llm.js";
import { streamChat as streamChatSarvam, type ChatMessage, type StreamChatOptions } from "./sarvam-llm.js";

export type { ChatMessage, StreamChatOptions };

export function streamChat(opts: StreamChatOptions): Promise<string> {
  return (process.env.LLM_PROVIDER || "gemini") === "sarvam"
    ? streamChatSarvam(opts)
    : streamChatGemini(opts);
}
