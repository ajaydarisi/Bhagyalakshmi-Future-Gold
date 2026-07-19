// One STT socket per voice session, held for the session's lifetime.
// Emits: "transcript" (string), "vad" ("START_SPEECH" | "END_SPEECH"),
// "fatal" (Error — after retries exhausted or a 4xxx application error).
import { EventEmitter } from "node:events";
import WebSocket from "ws";
import { CONFIG } from "../common/config.js";
import { env } from "../common/env.js";

const RETRYABLE = new Set([1001, 1006, 1011]); // per Sarvam streaming guide

export function isSttAudioBackpressured(bufferedAmount: number): boolean {
  return bufferedAmount >= CONFIG.maxSttBufferedBytes;
}

export class SttClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private closed = false;
  private backoffMs = 500;
  private retryTimer: NodeJS.Timeout | null = null;

  constructor(private readonly languageCode = "te-IN") {
    super();
  }

  connect(): void {
    if (this.closed) return;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const qs = new URLSearchParams({
      model: "saaras:v3",
      "language-code": this.languageCode,
      mode: "transcribe",
      sample_rate: "16000",
      input_audio_codec: "pcm_s16le",
      high_vad_sensitivity: "true", // 0.5s end-of-speech silence boundary
      vad_signals: "true",
      flush_signal: "true",
    });
    const ws = new WebSocket(`wss://api.sarvam.ai/speech-to-text/ws?${qs}`, {
      headers: { "api-subscription-key": env("SARVAM_API_KEY") },
    });
    this.ws = ws;

    ws.on("open", () => {
      if (this.ws !== ws || this.closed) return;
      this.backoffMs = 500;
    });

    ws.on("message", (raw) => {
      if (this.ws !== ws || this.closed) return;
      let msg: { type?: string; data?: Record<string, unknown> };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.type === "data") {
        const t = String(msg.data?.transcript ?? "").trim();
        if (t) this.emit("transcript", t);
      } else if (msg.type === "events") {
        this.emit("vad", msg.data?.signal_type);
      } else if (msg.type === "error") {
        this.emit("fatal", new Error(`STT error: ${JSON.stringify(msg.data)}`));
      }
    });

    // Rejected upgrade (non-101). Auth failures must not retry — a bad key
    // never fixes itself; everything else takes the normal backoff path.
    ws.on("unexpected-response", (_req, res) => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        this.fail(new Error(`STT auth rejected (HTTP ${res.statusCode})`));
      } else {
        this.scheduleRetry();
      }
    });

    ws.on("close", (code) => {
      if (this.ws !== ws || this.closed) return;
      this.ws = null;
      if (RETRYABLE.has(code)) {
        this.scheduleRetry();
      } else if (code !== 1000) {
        this.fail(new Error(`STT socket closed (${code})`));
      }
    });

    ws.on("error", () => {
      /* close handler decides; avoids unhandled 'error' crash */
    });
  }

  private scheduleRetry(): void {
    if (this.closed || this.retryTimer) return;
    if (this.backoffMs > 8000) {
      this.fail(new Error("STT reconnect retries exhausted"));
      return;
    }
    const delay = Math.round(this.backoffMs * (0.8 + Math.random() * 0.4));
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
    this.retryTimer.unref();
    this.backoffMs *= 2;
  }

  private fail(error: Error): void {
    if (this.closed) return;
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.ws?.terminate();
    this.ws = null;
    this.emit("fatal", error);
  }

  /** Drop-don't-queue while reconnecting or backpressured — stale audio is useless. */
  sendAudio(pcm: Buffer): void {
    const ws = this.ws;
    if (
      ws?.readyState !== WebSocket.OPEN ||
      isSttAudioBackpressured(ws.bufferedAmount)
    ) {
      return;
    }
    ws.send(
      JSON.stringify({
        audio: { data: pcm.toString("base64"), encoding: "audio/wav", sample_rate: 16000 },
      }),
    );
  }

  /** Force-finalize whatever the server has buffered (watchdog path). */
  flush(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "flush" }));
    }
  }

  close(): void {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.ws?.close(1000);
    this.ws = null;
  }
}
