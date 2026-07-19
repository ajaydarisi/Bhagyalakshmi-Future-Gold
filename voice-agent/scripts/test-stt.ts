// Phase 1 gate: stream samples/telugu-16k.wav to Sarvam streaming STT in real
// time; expect VAD events and a final Telugu transcript. Run: npm run test:stt
import { transcribeWavFile } from "./lib.js";

const wavPath = new URL("../samples/telugu-16k.wav", import.meta.url).pathname;

try {
  const result = await transcribeWavFile(wavPath, (l) => console.log(l));
  console.log("\n=== STT RESULT ===");
  console.log(`utterances: ${result.transcripts.length}`);
  for (const t of result.transcripts) console.log(`  "${t}"`);
  console.log(`metrics: ${JSON.stringify(result.metrics)}`);
  if (!result.transcripts.some((t) => t.trim().length > 0)) {
    console.error("FAIL: no non-empty transcript received");
    process.exit(1);
  }
  console.log("PASS: transcript received — compare against the ground truth printed by make-sample");
} catch (err) {
  console.error("FAIL:", err);
  process.exit(1);
}
