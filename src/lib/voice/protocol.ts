// Mirror of src/common/protocol.ts in github.com/ajaydarisi/bfg-voice-agent —
// keep the two in sync by hand. Now genuinely two repos, so a change here that
// is not mirrored there fails at runtime on the wire, not at build time.

export type SessionState = "listening" | "thinking" | "speaking";

export type ClientMsg =
  | { type: "interrupt"; utteranceId: number }
  | { type: "speak"; utteranceId: number; text: string; language?: "en" | "te" }
  | { type: "speak_start"; utteranceId: number; language?: "en" | "te" }
  | { type: "speak_delta"; utteranceId: number; text: string }
  | { type: "speak_end"; utteranceId: number }
  | { type: "speak_reset"; utteranceId: number };

export type ServerMsg =
  | { type: "state"; value: SessionState }
  | { type: "transcript"; utteranceId: number; text: string }
  | { type: "turn_cancelled"; utteranceId: number; reason: "barge_in" | "timeout" }
  | { type: "assistant_text"; utteranceId: number; text: string }
  | { type: "audio_reset"; utteranceId: number }
  | { type: "audio"; utteranceId: number; seq: number; data: string } // base64 MP3
  | { type: "utterance_end"; utteranceId: number }
  | { type: "error"; code: string; message: string; recoverable?: boolean };

function isUtteranceId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function parseServerMsg(value: unknown): ServerMsg | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;

  if (
    candidate.type === "state" &&
    (candidate.value === "listening" ||
      candidate.value === "thinking" ||
      candidate.value === "speaking")
  ) {
    return { type: "state", value: candidate.value };
  }
  if (
    candidate.type === "transcript" &&
    isUtteranceId(candidate.utteranceId) &&
    typeof candidate.text === "string"
  ) {
    return {
      type: "transcript",
      utteranceId: candidate.utteranceId,
      text: candidate.text,
    };
  }
  if (
    candidate.type === "turn_cancelled" &&
    isUtteranceId(candidate.utteranceId) &&
    (candidate.reason === "barge_in" || candidate.reason === "timeout")
  ) {
    return {
      type: "turn_cancelled",
      utteranceId: candidate.utteranceId,
      reason: candidate.reason,
    };
  }
  if (
    candidate.type === "assistant_text" &&
    isUtteranceId(candidate.utteranceId) &&
    typeof candidate.text === "string"
  ) {
    return {
      type: "assistant_text",
      utteranceId: candidate.utteranceId,
      text: candidate.text,
    };
  }
  if (candidate.type === "audio_reset" && isUtteranceId(candidate.utteranceId)) {
    return { type: "audio_reset", utteranceId: candidate.utteranceId };
  }
  if (
    candidate.type === "audio" &&
    isUtteranceId(candidate.utteranceId) &&
    isUtteranceId(candidate.seq) &&
    typeof candidate.data === "string"
  ) {
    return {
      type: "audio",
      utteranceId: candidate.utteranceId,
      seq: candidate.seq,
      data: candidate.data,
    };
  }
  if (candidate.type === "utterance_end" && isUtteranceId(candidate.utteranceId)) {
    return { type: "utterance_end", utteranceId: candidate.utteranceId };
  }
  if (
    candidate.type === "error" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  ) {
    return {
      type: "error",
      code: candidate.code,
      message: candidate.message,
      recoverable: candidate.recoverable === true,
    };
  }
  return null;
}
