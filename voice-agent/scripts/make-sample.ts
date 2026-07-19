// Generates samples/telugu-16k.wav via Sarvam's REST TTS so the STT tests have
// a deterministic input with known ground truth. Run once: npm run make-sample
import { mkdirSync, writeFileSync } from "node:fs";
import { env } from "./lib.js";

// Ground truth for the STT test — a store-relevant spoken question.
export const SAMPLE_TEXT = "నమస్కారం. ఈ రోజు బంగారం ధర ఎంత ఉంది?";

const key = env("SARVAM_API_KEY");

const res = await fetch("https://api.sarvam.ai/text-to-speech", {
  method: "POST",
  headers: { "api-subscription-key": key, "content-type": "application/json" },
  body: JSON.stringify({
    text: SAMPLE_TEXT,
    target_language_code: "te-IN",
    speaker: "shubh", // male, so the STT sample differs from the assistant voice (neha)
    model: "bulbul:v3",
    speech_sample_rate: 16000,
  }),
});

if (!res.ok) {
  console.error(`REST TTS failed: HTTP ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}

const body = (await res.json()) as { audios?: string[] };
if (!body.audios?.length) {
  console.error(`Unexpected response shape: ${JSON.stringify(body).slice(0, 500)}`);
  process.exit(1);
}

const wav = Buffer.from(body.audios[0], "base64");
mkdirSync(new URL("../samples/", import.meta.url), { recursive: true });
const out = new URL("../samples/telugu-16k.wav", import.meta.url);
writeFileSync(out, wav);
console.log(`Wrote ${wav.length} bytes to samples/telugu-16k.wav`);
console.log(`Ground truth: ${SAMPLE_TEXT}`);
