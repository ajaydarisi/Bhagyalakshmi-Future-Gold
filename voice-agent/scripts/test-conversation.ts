// Phase 2 gate: Telugu question → Sarvam LLM (streaming) → sentence chunker →
// Sarvam TTS → out/convo/reply.mp3, with per-stage timestamps.
//   npm run test:convo                              (default question)
//   npx tsx scripts/test-conversation.ts "ప్రశ్న"    (custom question)
//   npx tsx scripts/test-conversation.ts --abort-after-ms 400   (cancel drill)
import { SentenceChunker } from "../src/common/sentence-chunker.js";
import { streamChat } from "../src/llm/index.js";
import { SYSTEM_PROMPT } from "../src/llm/system-prompt.js";
import { openTtsStream } from "./lib.js";

const args = process.argv.slice(2);
const abortIdx = args.indexOf("--abort-after-ms");
const abortAfterMs = abortIdx >= 0 ? Number(args[abortIdx + 1]) : 0;
const question = args.filter((a, i) => i !== abortIdx && i !== abortIdx + 1)[0]
  ?? "మీ షాప్ ఎక్కడ ఉంది? ఎప్పుడు తెరిచి ఉంటుంది?";

const outFile = new URL("../out/convo/reply.mp3", import.meta.url).pathname;
const t0 = Date.now();
const at = () => `+${String(Date.now() - t0).padStart(5)}ms`;

const controller = new AbortController();
const tts = openTtsStream(outFile, (l) => console.log(`${at()} [tts] ${l}`));
const chunker = new SentenceChunker();
let firstDeltaAt = 0;
let firstSentenceAt = 0;

if (abortAfterMs > 0) {
  setTimeout(() => {
    console.log(`${at()} --- ABORT: cancelling LLM stream + closing TTS socket ---`);
    controller.abort();
    tts.close();
  }, abortAfterMs);
}

try {
  const full = await streamChat({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: question },
    ],
    signal: controller.signal,
    onReasoningStart: () => console.log(`${at()} [llm] reasoning started`),
    onDelta: (d) => {
      if (!firstDeltaAt) {
        firstDeltaAt = Date.now();
        console.log(`${at()} [llm] first delta`);
      }
      for (const s of chunker.push(d)) {
        if (!firstSentenceAt) firstSentenceAt = Date.now();
        console.log(`${at()} [llm] sentence → tts: "${s}"`);
        tts.sendText(s);
      }
    },
  });
  for (const s of chunker.finish()) {
    console.log(`${at()} [llm] tail sentence → tts: "${s}"`);
    tts.sendText(s);
  }
  tts.flush();
  console.log(`${at()} [llm] stream done. Full reply:\n---\n${full}\n---`);

  const r = await tts.done;
  console.log(`\n=== CONVERSATION RESULT ===`);
  console.log(`question: "${question}"`);
  console.log(`LLM first delta:      ${firstDeltaAt - t0}ms`);
  console.log(`first full sentence:  ${firstSentenceAt - t0}ms`);
  console.log(`TTS first audio byte: ${r.ttfbMs}ms after first sentence`);
  console.log(`PASS — listen: afplay ${r.outFile}`);
} catch (err) {
  if (controller.signal.aborted) {
    console.log(`${at()} aborted cleanly (LLM fetch + TTS socket torn down)`);
    process.exit(0);
  }
  console.error("FAIL:", err);
  process.exit(1);
}
