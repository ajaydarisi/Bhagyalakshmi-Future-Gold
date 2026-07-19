import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import WebSocket from "ws";
import { env } from "../src/common/env.js";

export { env };

// ---------------------------------------------------------------------------
// WAV parsing (walks RIFF chunks — some encoders insert LIST before data)
// ---------------------------------------------------------------------------

export interface WavData {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  pcm: Buffer;
}

export function parseWav(buf: Buffer): WavData {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("not a RIFF/WAVE file");
  }
  let off = 12;
  let fmt: { channels: number; sampleRate: number; bits: number } | null = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === "fmt ") {
      fmt = {
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      if (!fmt) throw new Error("data chunk before fmt chunk");
      return {
        sampleRate: fmt.sampleRate,
        channels: fmt.channels,
        bitsPerSample: fmt.bits,
        pcm: buf.subarray(body, Math.min(body + size, buf.length)),
      };
    }
    off = body + size + (size % 2);
  }
  throw new Error("no data chunk found");
}

// ---------------------------------------------------------------------------
// Sarvam streaming STT: stream a 16 kHz mono s16le WAV in real time,
// resolve with the final transcript(s).
// ---------------------------------------------------------------------------

export interface SttResult {
  transcripts: string[];
  metrics: unknown[];
}

export function transcribeWavFile(
  wavPath: string,
  onLog: (line: string) => void,
): Promise<SttResult> {
  const key = env("SARVAM_API_KEY");
  const wav = parseWav(readFileSync(wavPath));
  if (wav.sampleRate !== 16000 || wav.channels !== 1 || wav.bitsPerSample !== 16) {
    throw new Error(
      `sample must be 16 kHz mono s16le; got ${wav.sampleRate} Hz, ${wav.channels}ch, ${wav.bitsPerSample}-bit`,
    );
  }

  const qs = new URLSearchParams({
    model: "saaras:v3",
    "language-code": "te-IN",
    mode: "transcribe",
    sample_rate: "16000",
    input_audio_codec: "pcm_s16le",
    high_vad_sensitivity: "true",
    vad_signals: "true",
    flush_signal: "true",
  });
  const url = `wss://api.sarvam.ai/speech-to-text/ws?${qs}`;

  const FRAME_BYTES = 3200; // 100 ms of 16 kHz s16le mono
  const frames: Buffer[] = [];
  for (let i = 0; i < wav.pcm.length; i += FRAME_BYTES) {
    frames.push(wav.pcm.subarray(i, i + FRAME_BYTES));
  }

  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const at = () => `+${String(Date.now() - t0).padStart(5)}ms`;
    const result: SttResult = { transcripts: [], metrics: [] };
    let settleTimer: NodeJS.Timeout | null = null;
    let allAudioSent = false;

    const ws = new WebSocket(url, { headers: { "api-subscription-key": key } });
    const deadline = setTimeout(() => {
      ws.terminate();
      reject(new Error("STT timed out after 30s with no final transcript"));
    }, 30_000);

    const finish = () => {
      clearTimeout(deadline);
      if (settleTimer) clearTimeout(settleTimer);
      ws.close(1000);
      resolve(result);
    };

    // Resolve only when all audio is in AND the server has been quiet for 2s —
    // a per-transcript timer races with a second utterance still in flight.
    const bumpSettle = () => {
      if (!allAudioSent) return;
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(finish, 2000);
    };

    ws.on("open", () => {
      onLog(`${at()} STT socket open — streaming ${frames.length} × 100ms frames`);
      let i = 0;
      const pump = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return clearInterval(pump);
        if (i < frames.length) {
          ws.send(
            JSON.stringify({
              audio: {
                data: frames[i].toString("base64"),
                encoding: "audio/wav",
                sample_rate: 16000,
              },
            }),
          );
          i++;
        } else {
          clearInterval(pump);
          ws.send(JSON.stringify({ type: "flush" }));
          onLog(`${at()} all audio sent + flush`);
          allAudioSent = true;
          bumpSettle();
        }
      }, 100);
    });

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "events") {
        onLog(`${at()} VAD event: ${msg.data?.signal_type}`);
        bumpSettle();
      } else if (msg.type === "data") {
        const d = msg.data ?? {};
        result.transcripts.push(d.transcript ?? "");
        result.metrics.push(d.metrics ?? null);
        onLog(`${at()} transcript: "${d.transcript}"  metrics=${JSON.stringify(d.metrics)}`);
        bumpSettle();
      } else if (msg.type === "error") {
        clearTimeout(deadline);
        reject(new Error(`STT error: ${JSON.stringify(msg.data)}`));
      } else {
        onLog(`${at()} unknown message type: ${JSON.stringify(msg).slice(0, 200)}`);
      }
    });

    ws.on("close", (code) => onLog(`${at()} STT socket closed (${code})`));
    ws.on("error", (err) => {
      clearTimeout(deadline);
      reject(err);
    });
  });
}

// ---------------------------------------------------------------------------
// Sarvam streaming TTS. Incremental: open the socket early (hides the
// handshake), push sentences as the LLM produces them, flush at stream end.
// Closing the socket is the ONLY way to cancel (no server-side cancel exists).
// ---------------------------------------------------------------------------

export interface TtsResult {
  ttfbMs: number; // first audio byte after first sendText()
  chunkFiles: string[];
  outFile: string;
}

export interface TtsStream {
  sendText(text: string): void;
  flush(): void;
  close(): void; // barge-in style abort — discards everything in flight
  done: Promise<TtsResult>;
}

export function openTtsStream(outFile: string, onLog: (line: string) => void): TtsStream {
  const key = env("SARVAM_API_KEY");
  // Observed 2026-07-12: the `final` event only arrives when
  // send_completion_event=true is EXPLICIT in the URL (docs claim default true).
  const url = "wss://api.sarvam.ai/text-to-speech/ws?model=bulbul:v3&send_completion_event=true";
  const ws = new WebSocket(url, { headers: { "api-subscription-key": key } });

  const chunks: Buffer[] = [];
  const chunkFiles: string[] = [];
  const preOpenQueue: string[] = [];
  let preOpenFlush = false;
  let open = false;
  let tFirstText = 0;
  let ttfbMs = 0;
  let done = false;

  let resolveDone!: (r: TtsResult) => void;
  let rejectDone!: (e: Error) => void;
  const donePromise = new Promise<TtsResult>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });
  // A closed-by-barge-in stream's promise is simply abandoned by callers.
  donePromise.catch(() => {});

  const deadline = setTimeout(() => {
    ws.terminate();
    rejectDone(new Error("TTS timed out after 30s without a final event"));
  }, 30_000);

  let settleTimer: NodeJS.Timeout | null = null;
  const finish = (via: string) => {
    if (done) return;
    done = true;
    clearTimeout(deadline);
    if (settleTimer) clearTimeout(settleTimer);
    onLog(`complete via ${via}`);
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, Buffer.concat(chunks));
    ws.close(1000);
    resolveDone({ ttfbMs, chunkFiles, outFile });
  };
  // Fallback in case the final event doesn't arrive (seen intermittently).
  const bumpSettle = () => {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => finish("2.5s quiet-settle"), 2500);
  };

  const sendNow = (text: string) => {
    if (tFirstText === 0) tFirstText = Date.now();
    ws.send(JSON.stringify({ type: "text", data: { text } }));
  };

  ws.on("open", () => {
    open = true;
    ws.send(
      JSON.stringify({
        type: "config",
        data: {
          speaker: process.env.SARVAM_TTS_SPEAKER || "neha",
          target_language_code: "te-IN",
          speech_sample_rate: 24000,
          output_audio_codec: "mp3",
          min_buffer_size: 30,
        },
      }),
    );
    onLog("TTS socket open — config sent");
    for (const t of preOpenQueue) sendNow(t);
    preOpenQueue.length = 0;
    if (preOpenFlush) ws.send(JSON.stringify({ type: "flush" }));
  });

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === "audio") {
      const buf = Buffer.from(msg.data.audio, "base64");
      if (chunks.length === 0) {
        ttfbMs = Date.now() - tFirstText;
        onLog(`FIRST AUDIO BYTE ${ttfbMs}ms after first text`);
      }
      chunks.push(buf);
      const file = outFile.replace(/\.mp3$/, `-chunk${String(chunks.length - 1).padStart(3, "0")}.mp3`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, buf);
      chunkFiles.push(file);
      onLog(`audio chunk #${chunks.length - 1}: ${buf.length} bytes, first bytes 0x${buf.subarray(0, 3).toString("hex")}`);
      bumpSettle();
    } else if (msg.type === "event") {
      onLog(`event: ${msg.data?.event_type}`);
      if (msg.data?.event_type === "final") finish("final event");
    } else if (msg.type === "error") {
      clearTimeout(deadline);
      rejectDone(new Error(`TTS error: ${JSON.stringify(msg.data)}`));
    } else {
      onLog(`unknown message type: ${JSON.stringify(msg).slice(0, 200)}`);
    }
  });

  ws.on("error", (err) => {
    clearTimeout(deadline);
    rejectDone(err as Error);
  });

  return {
    sendText(text) {
      if (done) return;
      if (open && ws.readyState === WebSocket.OPEN) sendNow(text);
      else preOpenQueue.push(text);
    },
    flush() {
      if (done) return;
      if (open && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "flush" }));
      else preOpenFlush = true;
    },
    close() {
      done = true;
      clearTimeout(deadline);
      if (settleTimer) clearTimeout(settleTimer);
      ws.close(1000);
      rejectDone(new Error("cancelled"));
    },
    done: donePromise,
  };
}

export function synthesizeToFile(
  sentences: string[],
  outFile: string,
  onLog: (line: string) => void,
): Promise<TtsResult> {
  const tts = openTtsStream(outFile, onLog);
  for (const s of sentences) tts.sendText(s);
  tts.flush();
  return tts.done;
}
