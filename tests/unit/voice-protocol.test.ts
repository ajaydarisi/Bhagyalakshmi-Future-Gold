import { describe, expect, it } from "vitest";
import { parseServerMsg } from "@/lib/voice/protocol";

describe("voice protocol validation", () => {
  it("accepts typed state, transcript, cancellation, and recoverable errors", () => {
    expect(parseServerMsg({ type: "state", value: "listening" })).toEqual({
      type: "state",
      value: "listening",
    });
    expect(parseServerMsg({ type: "transcript", utteranceId: 2, text: "hello" })).toEqual({
      type: "transcript",
      utteranceId: 2,
      text: "hello",
    });
    expect(
      parseServerMsg({ type: "turn_cancelled", utteranceId: 2, reason: "barge_in" }),
    ).toEqual({ type: "turn_cancelled", utteranceId: 2, reason: "barge_in" });
    expect(parseServerMsg({ type: "audio_reset", utteranceId: 2 })).toEqual({
      type: "audio_reset",
      utteranceId: 2,
    });
    expect(
      parseServerMsg({ type: "error", code: "tts_failed", message: "failed", recoverable: true }),
    ).toEqual({ type: "error", code: "tts_failed", message: "failed", recoverable: true });
  });

  it("rejects unknown, malformed, and unsafe messages", () => {
    expect(parseServerMsg({ type: "state", value: "frozen" })).toBeNull();
    expect(parseServerMsg({ type: "audio", utteranceId: -1, seq: 0, data: "x" })).toBeNull();
    expect(parseServerMsg({ type: "transcript", utteranceId: 1 })).toBeNull();
    expect(parseServerMsg({ type: "surprise" })).toBeNull();
  });
});
