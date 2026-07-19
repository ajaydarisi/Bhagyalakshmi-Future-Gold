import {
  sanitizeAssistantNavigation,
  sanitizeAssistantNavigationOptions,
} from "@/lib/assistant-navigation";
import type { AssistantHandoff, AssistantReply } from "@/types/search";

export const ASSISTANT_STREAM_CONTENT_TYPE =
  "application/x-ndjson; charset=utf-8";
const MAX_STREAM_BYTES = 192 * 1024;
const MAX_EVENT_BYTES = 96 * 1024;

export type AssistantStreamEvent =
  | { type: "start" }
  | { type: "answer_delta"; delta: string }
  | { type: "answer_reset" }
  | {
      type: "result";
      reply: AssistantReply;
      handoff: AssistantHandoff | null;
    }
  | { type: "error"; message: string; status: number };

export function encodeAssistantStreamEvent(event: AssistantStreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

function parseAssistantStreamEvent(value: unknown): AssistantStreamEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Record<string, unknown>;
  if (event.type === "start" || event.type === "answer_reset") {
    return { type: event.type };
  }
  if (event.type === "answer_delta" && typeof event.delta === "string") {
    return { type: "answer_delta", delta: event.delta };
  }
  if (
    event.type === "error" &&
    typeof event.message === "string" &&
    typeof event.status === "number"
  ) {
    return { type: "error", message: event.message, status: event.status };
  }
  if (
    event.type === "result" &&
    event.reply &&
    typeof event.reply === "object"
  ) {
    const reply = event.reply as AssistantReply;
    const navigation = sanitizeAssistantNavigation(reply.navigation);
    const navigationOptions = sanitizeAssistantNavigationOptions(reply.navigationOptions);
    const replyWithoutNavigation = { ...reply };
    delete replyWithoutNavigation.navigation;
    delete replyWithoutNavigation.navigationOptions;
    return {
      type: "result",
      // The final result is the only stream event that may carry navigation.
      // Treat it as untrusted transport data even though the API constructs it.
      reply: {
        ...replyWithoutNavigation,
        ...(navigation ? { navigation } : {}),
        ...(navigationOptions.length > 0 ? { navigationOptions } : {}),
      },
      handoff:
        event.handoff && typeof event.handoff === "object"
          ? (event.handoff as AssistantHandoff)
          : null,
    };
  }
  return null;
}

export async function readAssistantStream(
  response: Response,
  handlers: {
    onAnswerDelta: (delta: string) => void;
    onAnswerReset: () => void;
  },
): Promise<{ reply: AssistantReply; handoff: AssistantHandoff | null }> {
  if (!response.ok || !response.body) {
    throw new Error(`Assistant stream failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let totalBytes = 0;
  let result: { reply: AssistantReply; handoff: AssistantHandoff | null } | null =
    null;

  const processLine = (line: string) => {
    if (!line.trim()) return;
    if (new TextEncoder().encode(line).byteLength > MAX_EVENT_BYTES) {
      throw new Error("Assistant stream event is too large");
    }
    const event = parseAssistantStreamEvent(JSON.parse(line));
    if (!event) throw new Error("Invalid assistant stream event");
    if (event.type === "answer_delta") handlers.onAnswerDelta(event.delta);
    if (event.type === "answer_reset") handlers.onAnswerReset();
    if (event.type === "error") {
      throw new Error(`${event.message} (${event.status})`);
    }
    if (event.type === "result") {
      result = { reply: event.reply, handoff: event.handoff };
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_STREAM_BYTES) {
        throw new Error("Assistant stream is too large");
      }
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        processLine(buffer.slice(0, newline).replace(/\r$/, ""));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) processLine(buffer);
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }

  if (!result) throw new Error("Assistant stream ended without a result");
  return result;
}
