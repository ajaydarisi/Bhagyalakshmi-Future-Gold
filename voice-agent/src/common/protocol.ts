// WS-1 protocol (browser ↔ voice service). Uplink audio travels as BINARY
// frames (16 kHz PCM s16le mono, ~100ms each); everything else is JSON text.
// Connection open = session start, connection close = session end.

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

export function parseClientMsg(value: unknown): ClientMsg | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const utteranceId = candidate.utteranceId;
  if (!Number.isSafeInteger(utteranceId) || (utteranceId as number) < 0) return null;

  if (candidate.type === "interrupt") {
    return { type: "interrupt", utteranceId: utteranceId as number };
  }
  if (candidate.type === "speak_start") {
    return {
      type: "speak_start",
      utteranceId: utteranceId as number,
      ...(candidate.language === "en" || candidate.language === "te"
        ? { language: candidate.language }
        : {}),
    };
  }
  if (candidate.type === "speak_end" || candidate.type === "speak_reset") {
    return { type: candidate.type, utteranceId: utteranceId as number };
  }
  if (
    (candidate.type === "speak" || candidate.type === "speak_delta") &&
    typeof candidate.text === "string"
  ) {
    const text = candidate.text.trim();
    const maxLength = candidate.type === "speak" ? 4000 : 1000;
    if (!text || text.length > maxLength) return null;
    return {
      type: candidate.type,
      utteranceId: utteranceId as number,
      text,
      ...(candidate.type === "speak" &&
      (candidate.language === "en" || candidate.language === "te")
        ? { language: candidate.language }
        : {}),
    };
  }
  return null;
}
