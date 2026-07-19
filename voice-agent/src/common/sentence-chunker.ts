// Accumulates LLM text deltas and emits complete sentences — the unit we feed
// to TTS so barge-in discards at most one sentence of audio.
// ponytail: splits on terminator+whitespace only; "3.5" style decimals survive,
// a terminator at the very end of the stream is flushed by finish().
const BOUNDARY = /(?<=[.?!।])\s+/;

export class SentenceChunker {
  private buf = "";

  push(delta: string): string[] {
    this.buf += delta;
    const parts = this.buf.split(BOUNDARY);
    if (parts.length === 1) return [];
    this.buf = parts[parts.length - 1];
    return parts.slice(0, -1).map((s) => s.trim()).filter(Boolean);
  }

  finish(): string[] {
    const tail = this.buf.trim();
    this.buf = "";
    return tail ? [tail] : [];
  }
}

// Self-check: npx tsx src/common/sentence-chunker.ts
import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const c = new SentenceChunker();
  const out: string[] = [];
  for (const d of ["నమస్కారం అం", "డి. మీకు ఏం కావా", "లండి? ధర "]) out.push(...c.push(d));
  out.push(...c.finish());
  const expect = ["నమస్కారం అండి.", "మీకు ఏం కావాలండి?", "ధర"];
  if (JSON.stringify(out) !== JSON.stringify(expect)) {
    console.error("FAIL", out);
    process.exit(1);
  }
  const c2 = new SentenceChunker();
  if (c2.push("no terminator yet").length !== 0 || c2.finish()[0] !== "no terminator yet") {
    console.error("FAIL tail case");
    process.exit(1);
  }
  console.log("sentence-chunker self-check PASS");
}
