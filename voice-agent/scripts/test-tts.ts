// Phase 1 gate: stream two Telugu sentences through Sarvam streaming TTS,
// measure time-to-first-audio-byte, save per-chunk MP3s + concatenation.
// Run: npm run test:tts   Then listen: afplay voice-agent/out/tts/out.mp3
import { execFileSync } from "node:child_process";
import { synthesizeToFile } from "./lib.js";

const SENTENCES = [
  "నమస్కారం అండి, భాగ్యలక్ష్మి ఫ్యూచర్ గోల్డ్ కి స్వాగతం.",
  "ఈ రోజు బంగారం ధర గురించి చెప్పమంటారా?",
];

const outFile = new URL("../out/tts/out.mp3", import.meta.url).pathname;

try {
  const r = await synthesizeToFile(SENTENCES, outFile, (l) => console.log(l));
  console.log("\n=== TTS RESULT ===");
  console.log(`TTFB: ${r.ttfbMs}ms   chunks: ${r.chunkFiles.length}   out: ${r.outFile}`);

  // Decodability check: are individual chunks standalone-playable MP3s?
  // (The Phase 4 player design assumes yes — this answers the plan's open question.)
  let ffmpegAvailable = true;
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    ffmpegAvailable = false;
    console.log("ffmpeg not found — skipped per-chunk decode check; listen to the chunk files manually");
  }
  if (ffmpegAvailable) {
    let ok = 0;
    for (const f of [...r.chunkFiles, r.outFile]) {
      try {
        execFileSync("ffmpeg", ["-v", "error", "-i", f, "-f", "null", "-"], { stdio: "ignore" });
        ok++;
      } catch {
        console.log(`chunk NOT independently decodable: ${f}`);
      }
    }
    console.log(`decode check: ${ok}/${r.chunkFiles.length + 1} files decode cleanly`);
  }
  console.log(`PASS — now listen: afplay ${r.outFile}`);
} catch (err) {
  console.error("FAIL:", err);
  process.exit(1);
}
