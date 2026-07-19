import "dotenv/config";

function numberEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const CONFIG = {
  port: numberEnv("PORT", 8080, 1, 65535),
  /** Empty is accepted only outside production; production validation fails fast. */
  allowedOrigins,
  /** Each session holds 1 STT + up to 1 TTS socket; Sarvam Starter allows 20 total. */
  maxSessions: numberEnv("MAX_CONCURRENT_SESSIONS", 8, 1, 100),
  sessionMaxMs: numberEnv("SESSION_MAX_SECONDS", 600, 30, 3600) * 1000,
  sessionIdleMs: numberEnv("SESSION_IDLE_SECONDS", 120, 15, 900) * 1000,
  /** Quiet time after a finalized STT fragment before a grounded turn starts. */
  assistantUtteranceSettleMs: numberEnv("ASSISTANT_UTTERANCE_SETTLE_MS", 1400, 600, 5000),
  /** Browser retrieval/LLM must answer before the realtime turn is released. */
  assistantResponseTimeoutMs:
    numberEnv("ASSISTANT_RESPONSE_TIMEOUT_SECONDS", 30, 5, 120) * 1000,
  maxAudioFrameBytes: numberEnv("MAX_AUDIO_FRAME_BYTES", 16_384, 3200, 65_536),
  /** Drop stale browser audio instead of allowing a slow STT provider to retain it. */
  maxSttBufferedBytes: numberEnv("MAX_STT_BUFFERED_BYTES", 262_144, 65_536, 8_388_608),
  maxSocketBufferedBytes: numberEnv("MAX_SOCKET_BUFFERED_BYTES", 1_048_576, 65_536, 8_388_608),
  heartbeatMs: numberEnv("WS_HEARTBEAT_SECONDS", 30, 10, 120) * 1000,
};
