// One TTS socket PER ASSISTANT UTTERANCE. close() IS the cancel — the Sarvam
// TTS WebSocket has no server-side cancel message (verified 2026-07-12), so
// barge-in = close this socket and open a fresh one for the next reply.
import WebSocket from "ws";
import { env } from "../common/env.js";

export interface TtsUtterance {
  sendText(text: string): void;
  flush(): void;
  close(): void;
}

export interface TtsHandlers {
  onAudio: (chunk: Buffer) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

export function openTtsUtterance(
  h: TtsHandlers,
  languageCode = "te-IN",
): TtsUtterance {
  // final event only arrives with send_completion_event=true EXPLICIT (docs
  // claim default true; observed otherwise 2026-07-12).
  const ws = new WebSocket(
    "wss://api.sarvam.ai/text-to-speech/ws?model=bulbul:v3&send_completion_event=true",
    { headers: { "api-subscription-key": env("SARVAM_API_KEY") } },
  );

  const preOpenQueue: string[] = [];
  let preOpenFlush = false;
  let open = false;
  let done = false;
  let flushed = false;
  let settleTimer: NodeJS.Timeout | null = null;
  const connectTimer = setTimeout(() => {
    fail(new Error("TTS connection timed out"));
  }, 8000);
  connectTimer.unref();

  const clearTimers = () => {
    clearTimeout(connectTimer);
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = null;
  };

  const fail = (error: Error) => {
    if (done) return;
    done = true;
    clearTimers();
    if (ws.readyState === WebSocket.OPEN) ws.close(1011);
    else if (ws.readyState === WebSocket.CONNECTING) ws.terminate();
    h.onError(error);
  };

  const finish = () => {
    if (done) return;
    done = true;
    clearTimers();
    ws.close(1000);
    h.onDone();
  };

  // Quiet-settle fallback for a missing final event — armed only after flush()
  // (mid-reply gaps while the LLM is still producing must not end the utterance).
  const bumpSettle = () => {
    if (!flushed) return;
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(finish, 2500);
  };

  ws.on("open", () => {
    clearTimeout(connectTimer);
    open = true;
    ws.send(
      JSON.stringify({
        type: "config",
        data: {
          speaker: process.env.SARVAM_TTS_SPEAKER || "neha",
          // Slightly faster than neha's default delivery; 1.0 is normal speed.
          pace: Number(process.env.SARVAM_TTS_PACE) || 1.2,
          target_language_code: languageCode,
          speech_sample_rate: 24000,
          output_audio_codec: "mp3",
          min_buffer_size: 30,
        },
      }),
    );
    for (const t of preOpenQueue) ws.send(JSON.stringify({ type: "text", data: { text: t } }));
    preOpenQueue.length = 0;
    if (preOpenFlush) {
      ws.send(JSON.stringify({ type: "flush" }));
      bumpSettle();
    }
  });

  ws.on("message", (raw) => {
    if (done) return;
    let msg: { type?: string; data?: Record<string, unknown> };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === "audio") {
      h.onAudio(Buffer.from(String(msg.data?.audio), "base64"));
      bumpSettle();
    } else if (msg.type === "event" && msg.data?.event_type === "final") {
      finish();
    } else if (msg.type === "error") {
      fail(new Error(`TTS error: ${JSON.stringify(msg.data)}`));
    }
  });

  ws.on("error", (err) => {
    fail(err as Error);
  });

  ws.on("close", (code) => {
    if (!done) fail(new Error(`TTS socket closed before completion (${code})`));
  });

  return {
    sendText(text) {
      if (done) return;
      if (open && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "text", data: { text } }));
      } else {
        preOpenQueue.push(text);
      }
    },
    flush() {
      if (done) return;
      flushed = true;
      if (open && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "flush" }));
        bumpSettle();
      } else {
        preOpenFlush = true;
      }
    },
    close() {
      // Barge-in path: no onDone, no onError — the caller already moved on.
      done = true;
      clearTimers();
      if (ws.readyState === WebSocket.OPEN) ws.close(1000);
      else if (ws.readyState === WebSocket.CONNECTING) ws.terminate();
    },
  };
}
