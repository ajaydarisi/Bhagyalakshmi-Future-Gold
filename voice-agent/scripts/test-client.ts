// Phase 3 gate: act as the browser. Connects with a self-minted token, streams
// the sample WAV as binary frames in real time, logs every downlink message,
// saves the reply audio. Run the server first: npm run dev
//   npm run test:client                     (valid token, full turn)
//   npx tsx scripts/test-client.ts --assistant  (STT → external answer → TTS)
//   npx tsx scripts/test-client.ts --transcribe (STT only; no LLM/TTS payloads)
//   npx tsx scripts/test-client.ts --bad-token   (expect close 4401)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import WebSocket from "ws";
import { mintSessionToken } from "../src/auth/session-token.js";
import { parseWav } from "./lib.js";

const badToken = process.argv.includes("--bad-token");
const assistantMode = process.argv.includes("--assistant");
const transcribeOnly = process.argv.includes("--transcribe");
const token = badToken ? "garbage" : mintSessionToken("test-client");
const url = new URL(`ws://localhost:${process.env.PORT || 8080}/session`);
url.searchParams.set("token", token);
if (assistantMode) url.searchParams.set("mode", "assistant");
if (transcribeOnly) url.searchParams.set("mode", "transcribe");
const outFile = new URL("../out/client/reply.mp3", import.meta.url).pathname;

const t0 = Date.now();
const at = () => `+${String(Date.now() - t0).padStart(5)}ms`;
const audio: Buffer[] = [];
let sawTranscript = false;
let sawAssistantPayload = false;

const ws = new WebSocket(url);
const deadline = setTimeout(() => {
  console.error("FAIL: timed out after 60s");
  process.exit(1);
}, 60_000);

ws.on("open", () => {
  if (badToken) return; // server should close us before/instead of this mattering
  console.log(`${at()} connected — streaming sample WAV as binary frames`);
  const wav = parseWav(readFileSync(new URL("../samples/telugu-16k.wav", import.meta.url).pathname));
  let i = 0;
  const pump = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) return clearInterval(pump);
    const frame = wav.pcm.subarray(i * 3200, (i + 1) * 3200);
    if (frame.length === 0) return clearInterval(pump);
    ws.send(frame);
    i++;
  }, 100);
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === "audio") {
    sawAssistantPayload = true;
    audio.push(Buffer.from(msg.data, "base64"));
    if (audio.length === 1) console.log(`${at()} first audio chunk`);
  } else {
    console.log(`${at()} ${JSON.stringify(msg).slice(0, 220)}`);
    if (msg.type === "assistant_text" || msg.type === "utterance_end") {
      sawAssistantPayload = true;
    }
    if (msg.type === "transcript") {
      sawTranscript = true;
      if (assistantMode) {
        ws.send(JSON.stringify({
          type: "speak",
          utteranceId: msg.utteranceId,
          text: "మీ ప్రశ్నకు సరిపోయే వివరాలు మరియు ఆభరణాలను చూపిస్తున్నాను.",
        }));
      }
      if (transcribeOnly) {
        setTimeout(() => {
          clearTimeout(deadline);
          const ok = !sawAssistantPayload && audio.length === 0;
          console.log(`\n${ok ? "PASS" : "FAIL"}: transcription-only mode returned transcript without LLM/TTS payloads`);
          ws.close(1000);
          process.exit(ok ? 0 : 1);
        }, 500);
      }
    }
    if (!transcribeOnly && msg.type === "utterance_end") {
      clearTimeout(deadline);
      mkdirSync(dirname(outFile), { recursive: true });
      writeFileSync(outFile, Buffer.concat(audio));
      console.log(`\n=== CLIENT RESULT ===`);
      console.log(`transcript seen: ${sawTranscript}, audio chunks: ${audio.length}`);
      console.log(`PASS — listen: afplay ${outFile}`);
      ws.close(1000);
      process.exit(0);
    }
  }
});

ws.on("close", (code, reason) => {
  if (badToken) {
    clearTimeout(deadline);
    const ok = code === 4401;
    console.log(`${ok ? "PASS" : "FAIL"}: closed with ${code} ${reason.toString()}`);
    process.exit(ok ? 0 : 1);
  }
  console.log(`${at()} closed (${code})`);
});

ws.on("error", (err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
