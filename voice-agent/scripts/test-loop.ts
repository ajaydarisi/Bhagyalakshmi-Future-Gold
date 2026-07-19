// Phase 1 gate: STT out → TTS in (echo bot, no LLM). Proves both Sarvam
// sockets coexist in one process and measures the handoff.
// Run: npm run test:loop   Then listen: afplay voice-agent/out/loop/echo.mp3
import { synthesizeToFile, transcribeWavFile } from "./lib.js";

const wavPath = new URL("../samples/telugu-16k.wav", import.meta.url).pathname;
const outFile = new URL("../out/loop/echo.mp3", import.meta.url).pathname;

try {
  const stt = await transcribeWavFile(wavPath, (l) => console.log(`[stt] ${l}`));
  const text = stt.transcripts.join(" ").trim();
  if (!text) {
    console.error("FAIL: empty transcript, nothing to synthesize");
    process.exit(1);
  }
  console.log(`\nhandoff → synthesizing: "${text}"`);
  const tHandoff = Date.now();
  const tts = await synthesizeToFile([text], outFile, (l) => console.log(`[tts] ${l}`));
  console.log("\n=== LOOP RESULT ===");
  console.log(`transcript: "${text}"`);
  console.log(`handoff→done: ${Date.now() - tHandoff}ms (TTS TTFB after connect: ${tts.ttfbMs}ms)`);
  console.log(`PASS — listen: afplay ${outFile}`);
} catch (err) {
  console.error("FAIL:", err);
  process.exit(1);
}
