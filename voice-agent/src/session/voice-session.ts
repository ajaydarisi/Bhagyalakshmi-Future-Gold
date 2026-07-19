// Conversation mode: listening → thinking → speaking → listening.
// Assistant mode delegates grounded reasoning to the storefront, then speaks
// its structured answer; transcription mode only forwards finalized text.
// "interrupted" is a transition, not a state (docs/voice-assistant-build-plan.md §4.3).
import type WebSocket from "ws";
import { CONFIG } from "../common/config.js";
import type { ClientMsg, ServerMsg, SessionState } from "../common/protocol.js";
import { SentenceChunker } from "../common/sentence-chunker.js";
import { streamChat, type ChatMessage } from "../llm/index.js";
import { SYSTEM_PROMPT } from "../llm/system-prompt.js";
import { SttClient } from "../providers/sarvam-stt.client.js";
import { openTtsUtterance, type TtsUtterance } from "../providers/sarvam-tts.client.js";

const HISTORY_TURNS = 12;
export type VoiceSessionMode = "conversation" | "assistant" | "transcribe";
export type VoiceTtsLanguageCode = "en-IN" | "te-IN";
export type VoiceLanguageCode = VoiceTtsLanguageCode | "unknown";

export interface VoiceSessionDependencies {
  stt?: SttClient;
  openTts?: typeof openTtsUtterance;
  assistantSettleMs?: number;
  assistantResponseTimeoutMs?: number;
}

export class VoiceSession {
  private state: SessionState = "listening";
  private readonly stt: SttClient;
  private readonly openTtsTransport: typeof openTtsUtterance;
  private readonly assistantSettleMs: number;
  private readonly assistantResponseTimeoutMs: number;
  private tts: TtsUtterance | null = null;
  private llmAbort: AbortController | null = null;
  private history: ChatMessage[] = [];
  private utteranceId = 0;
  private spokenText = ""; // sentences actually sent to TTS this utterance
  private destroyed = false;
  private idleTimer!: NodeJS.Timeout;
  private readonly maxTimer: NodeJS.Timeout;

  private sttWatchdog: NodeJS.Timeout | null = null;
  private assistantFinalizeTimer: NodeJS.Timeout | null = null;
  private assistantResponseTimer: NodeJS.Timeout | null = null;
  private pendingAssistantTranscript = "";
  private activeAssistantTranscript = "";
  private assistantSpeechChars = 0;
  private assistantTtsLanguageCode: VoiceTtsLanguageCode;

  constructor(
    private readonly ws: WebSocket,
    private readonly log: (msg: string) => void,
    private readonly mode: VoiceSessionMode = "conversation",
    private readonly languageCode: VoiceLanguageCode = "te-IN",
    dependencies: VoiceSessionDependencies = {},
  ) {
    this.assistantTtsLanguageCode =
      languageCode === "en-IN" ? "en-IN" : "te-IN";
    this.stt = dependencies.stt ?? new SttClient(languageCode);
    this.openTtsTransport = dependencies.openTts ?? openTtsUtterance;
    this.assistantSettleMs =
      dependencies.assistantSettleMs ?? CONFIG.assistantUtteranceSettleMs;
    this.assistantResponseTimeoutMs =
      dependencies.assistantResponseTimeoutMs ?? CONFIG.assistantResponseTimeoutMs;
    this.stt.on("transcript", (text: string) => {
      this.clearSttWatchdog();
      this.onTranscript(text);
    });
    // Watchdog: END_SPEECH with no transcript within 5s → flush; still nothing
    // 3s later → spoken re-prompt (plan §Phase 6 failure matrix).
    this.stt.on("vad", (signal: string) => {
      if (this.mode === "assistant") {
        if (signal === "START_SPEECH") {
          // Postpone finalize while sound continues, but never cancel an
          // in-flight turn on a raw VAD blip — ambient noise trips Sarvam's
          // high-sensitivity VAD. Cancellation waits for a real transcript
          // (onTranscript), i.e. actual recognized words.
          this.clearAssistantFinalizeTimer();
          return;
        }
        if (
          signal === "END_SPEECH" &&
          this.state === "listening" &&
          this.pendingAssistantTranscript
        ) {
          this.clearSttWatchdog();
          this.scheduleAssistantFinalize();
          return;
        }
      }
      if (signal !== "END_SPEECH" || this.state !== "listening") return;
      this.clearSttWatchdog();
      this.sttWatchdog = setTimeout(() => {
        this.log("STT watchdog: no transcript 5s after END_SPEECH — flushing");
        this.stt.flush();
        this.sttWatchdog = setTimeout(() => {
          if (this.mode === "transcribe") {
            this.log("STT watchdog: still nothing — ending transcription");
            this.sendMsg({ type: "error", code: "no_speech", message: "no speech detected" });
            this.ws.close(1000);
          } else {
            this.log("STT watchdog: still nothing — spoken re-prompt");
            this.speakCanned("క్షమించండి అండి, సరిగ్గా వినపడలేదు. మళ్ళీ చెప్పండి?");
          }
        }, 3000);
      }, 5000);
    });
    this.stt.on("fatal", (err: Error) => {
      this.log(`STT fatal: ${err.message}`);
      this.sendMsg({ type: "error", code: "stt_failed", message: "speech recognition unavailable" });
      this.ws.close(1011);
    });
    this.stt.connect();

    this.maxTimer = setTimeout(() => this.expire("session_max"), CONFIG.sessionMaxMs);
    this.bumpIdle();
    this.sendMsg({ type: "state", value: "listening" });
  }

  onAudio(pcm: Buffer): void {
    this.stt.sendAudio(pcm); // every state — barge-in speech must reach STT
  }

  onControl(msg: ClientMsg): void {
    if (msg.type === "interrupt") {
      this.activeAssistantTranscript = "";
      this.interrupt(msg.utteranceId);
    }
    if (msg.type === "speak") {
      this.speakAssistantResponse(
        msg.utteranceId,
        msg.text,
        this.toTtsLanguageCode(msg.language),
      );
    }
    if (msg.type === "speak_start") {
      this.startAssistantSpeech(
        msg.utteranceId,
        this.toTtsLanguageCode(msg.language),
      );
    }
    if (msg.type === "speak_delta") {
      this.appendAssistantSpeech(msg.utteranceId, msg.text);
    }
    if (msg.type === "speak_end") this.finishAssistantSpeech(msg.utteranceId);
    if (msg.type === "speak_reset") this.resetAssistantSpeech(msg.utteranceId);
  }

  private onTranscript(text: string): void {
    this.bumpIdle();
    if (this.mode === "transcribe") {
      this.log("transcription complete");
      const id = ++this.utteranceId;
      this.sendMsg({ type: "transcript", utteranceId: id, text });
      return;
    }
    if (this.mode === "assistant") {
      if (this.state === "thinking") {
        this.log("speech continued while grounded reply was pending");
        this.resumeAssistantInput();
      }
      if (this.state === "speaking") {
        this.log("barge-in via STT transcript during grounded reply");
        this.interrupt(this.utteranceId, true);
      }
      this.pendingAssistantTranscript = this.pendingAssistantTranscript
        ? `${this.pendingAssistantTranscript} ${text}`
        : text;
      this.log(`buffered transcript fragment; waiting ${this.assistantSettleMs}ms for turn end`);
      this.scheduleAssistantFinalize();
      return;
    }

    if (this.state === "listening") {
      this.startTurn(text);
    } else if (this.state === "speaking") {
      // Server-side barge-in backstop (client VAD is the fast path, Phase 5):
      // user spoke over the assistant — cancel and treat as the next turn.
      this.log(`barge-in via STT transcript during speaking`);
      this.interrupt(this.utteranceId);
      this.startTurn(text);
    } else {
      // thinking: reply not yet audible; fold the addition into the same turn
      // by restarting with the combined text.
      this.log(`transcript during thinking — restarting turn`);
      const prev = this.history.pop(); // the pending user turn
      this.cancelWork();
      this.startTurn(prev ? `${prev.content} ${text}` : text);
    }
  }

  /** Standard per-utterance TTS socket with stale-id gating + latency log. */
  private openTts(
    id: number,
    t0: number,
    languageCode: VoiceTtsLanguageCode = this.assistantTtsLanguageCode,
  ): TtsUtterance {
    let firstAudio = true;
    this.seq = 0;
    const tts = this.openTtsTransport({
      onAudio: (chunk) => {
        if (id !== this.utteranceId) return; // stale after barge-in
        if (this.ws.bufferedAmount > CONFIG.maxSocketBufferedBytes) {
          this.log(`turn ${id}: client backpressure exceeded; ending audio`);
          this.sendMsg({
            type: "error",
            code: "audio_backpressure",
            message: "audio connection is too slow",
            recoverable: true,
          });
          this.tts?.close();
          this.tts = null;
          this.clearAssistantResponseTimer();
          this.sendMsg({ type: "utterance_end", utteranceId: id });
          this.setState("listening");
          return;
        }
        if (firstAudio) {
          firstAudio = false;
          this.log(`turn ${id}: first audio +${Date.now() - t0}ms`);
        }
        this.sendMsg({ type: "audio", utteranceId: id, seq: this.seq++, data: chunk.toString("base64") });
      },
      onDone: () => {
        if (id !== this.utteranceId) return;
        this.clearAssistantResponseTimer();
        this.sendMsg({ type: "utterance_end", utteranceId: id });
        this.tts = null;
        this.setState("listening");
        this.bumpIdle();
      },
      onError: (err) => {
        if (id !== this.utteranceId) return;
        this.clearAssistantResponseTimer();
        this.log(`TTS error: ${err.message}`);
        // ponytail: degrade to on-screen text (already streamed); resynthesis
        // of the unspoken remainder is the upgrade path if this fires often.
        this.sendMsg({ type: "error", code: "tts_failed", message: "audio unavailable" });
        this.sendMsg({ type: "utterance_end", utteranceId: id });
        this.tts = null;
        this.setState("listening");
      },
    }, languageCode);
    this.tts = tts;
    return tts;
  }

  /** Speak a fixed line without an LLM turn (watchdog re-prompts etc.). */
  private speakCanned(text: string): void {
    if (this.destroyed || this.state !== "listening") return;
    const id = ++this.utteranceId;
    const tts = this.openTts(id, Date.now());
    this.setState("speaking");
    this.sendMsg({ type: "assistant_text", utteranceId: id, text });
    tts.sendText(text);
    tts.flush();
  }

  private clearSttWatchdog(): void {
    if (this.sttWatchdog) {
      clearTimeout(this.sttWatchdog);
      this.sttWatchdog = null;
    }
  }

  private startTurn(userText: string): void {
    const id = ++this.utteranceId;
    const t0 = Date.now();
    this.spokenText = "";
    this.setState("thinking");
    this.sendMsg({ type: "transcript", utteranceId: id, text: userText });
    this.history.push({ role: "user", content: userText });

    // Open the TTS socket now — its ~250ms handshake hides behind LLM latency.
    const tts = this.openTts(id, t0);
    let firstSentence = true;

    const abort = new AbortController();
    this.llmAbort = abort;
    const chunker = new SentenceChunker();

    const onSentence = (s: string) => {
      if (id !== this.utteranceId) return;
      if (firstSentence) {
        firstSentence = false;
        this.log(`turn ${id}: first sentence +${Date.now() - t0}ms`);
      }
      if (this.state === "thinking") this.setState("speaking");
      this.sendMsg({ type: "assistant_text", utteranceId: id, text: s });
      this.spokenText += (this.spokenText ? " " : "") + s;
      tts.sendText(s);
    };

    streamChat({
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...this.history.slice(-HISTORY_TURNS)],
      signal: abort.signal,
      onDelta: (d) => {
        for (const s of chunker.push(d)) onSentence(s);
      },
    })
      .then((full) => {
        if (id !== this.utteranceId) return;
        for (const s of chunker.finish()) onSentence(s);
        tts.flush();
        this.history.push({ role: "assistant", content: full });
      })
      .catch((err) => {
        if (abort.signal.aborted || id !== this.utteranceId) return;
        this.log(`LLM error: ${err.message}`);
        // Spoken apology keeps the interaction alive (plan §Phase 6 matrix).
        const apology = "క్షమించండి అండి, కొంచెం సేపు ఆగి మళ్ళీ అడగండి.";
        onSentence(apology);
        tts.flush();
        this.history.push({ role: "assistant", content: apology });
      });
  }

  /** Grounded assistant mode: storefront owns retrieval/UI; this service owns realtime audio. */
  private startAssistantTurn(userText: string): void {
    const id = ++this.utteranceId;
    this.spokenText = "";
    this.activeAssistantTranscript = userText;
    this.setState("thinking");
    this.sendMsg({ type: "transcript", utteranceId: id, text: userText });
    this.armAssistantResponseTimer(id);
  }

  private resumeAssistantInput(): void {
    if (this.state !== "thinking") return;
    const currentId = this.utteranceId;
    if (this.activeAssistantTranscript && !this.pendingAssistantTranscript) {
      this.pendingAssistantTranscript = this.activeAssistantTranscript;
    }
    this.activeAssistantTranscript = "";
    this.log(`turn ${currentId}: speech resumed; cancelling grounded request`);
    this.interrupt(currentId, true);
  }

  private scheduleAssistantFinalize(): void {
    this.clearAssistantFinalizeTimer();
    this.assistantFinalizeTimer = setTimeout(() => {
      this.assistantFinalizeTimer = null;
      if (this.destroyed || this.state !== "listening") return;
      const transcript = this.pendingAssistantTranscript.replace(/\s+/g, " ").trim();
      this.pendingAssistantTranscript = "";
      if (!transcript) return;
      this.log("quiet window complete — starting grounded turn");
      this.startAssistantTurn(transcript);
    }, this.assistantSettleMs);
  }

  private clearAssistantFinalizeTimer(): void {
    if (!this.assistantFinalizeTimer) return;
    clearTimeout(this.assistantFinalizeTimer);
    this.assistantFinalizeTimer = null;
  }

  private clearAssistantResponseTimer(): void {
    if (!this.assistantResponseTimer) return;
    clearTimeout(this.assistantResponseTimer);
    this.assistantResponseTimer = null;
  }

  private armAssistantResponseTimer(id: number): void {
    this.clearAssistantResponseTimer();
    this.assistantResponseTimer = setTimeout(() => {
      this.assistantResponseTimer = null;
      if (
        this.destroyed ||
        id !== this.utteranceId ||
        (this.state !== "thinking" && this.state !== "speaking")
      ) {
        return;
      }
      this.log(`turn ${id}: storefront response stream timed out`);
      this.tts?.close();
      this.tts = null;
      this.sendMsg({ type: "turn_cancelled", utteranceId: id, reason: "timeout" });
      this.sendMsg({
        type: "error",
        code: "assistant_timeout",
        message: "assistant response timed out",
        recoverable: true,
      });
      this.sendMsg({ type: "utterance_end", utteranceId: id });
      this.activeAssistantTranscript = "";
      this.utteranceId++;
      this.setState("listening");
      this.bumpIdle();
    }, this.assistantResponseTimeoutMs);
  }

  private startAssistantSpeech(
    id: number,
    languageCode = this.assistantTtsLanguageCode,
  ): void {
    if (this.mode !== "assistant" || id !== this.utteranceId || this.state !== "thinking") {
      this.log(`ignored stale assistant stream start for turn ${id}`);
      return;
    }
    this.clearAssistantResponseTimer();
    this.activeAssistantTranscript = "";
    this.assistantSpeechChars = 0;
    this.spokenText = "";
    this.assistantTtsLanguageCode = languageCode;
    this.tts = this.openTts(id, Date.now(), languageCode);
    this.setState("speaking");
    this.armAssistantResponseTimer(id);
  }

  private appendAssistantSpeech(id: number, rawText: string): void {
    if (
      this.mode !== "assistant" ||
      id !== this.utteranceId ||
      this.state !== "speaking" ||
      !this.tts
    ) {
      this.log(`ignored stale assistant stream delta for turn ${id}`);
      return;
    }
    const text = rawText
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Bracketed asides (transliterations, "(Owner / Proprietor)" glosses) are
      // visual annotations — drop them from speech, keep them on screen.
      .replace(/\([^)]*\)/g, " ")
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/[*_`#>~]/g, "")
      .replace(/\s+([,.!?।])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return;
    if (this.assistantSpeechChars + text.length > 4000) {
      this.log(`turn ${id}: assistant speech stream exceeded text limit`);
      this.sendMsg({
        type: "error",
        code: "tts_text_limit",
        message: "spoken response is too long",
        recoverable: true,
      });
      this.finishAssistantSpeech(id);
      return;
    }
    this.assistantSpeechChars += text.length;
    this.spokenText += `${this.spokenText ? " " : ""}${text}`;
    this.sendMsg({ type: "assistant_text", utteranceId: id, text });
    this.tts.sendText(text);
    this.armAssistantResponseTimer(id);
  }

  private finishAssistantSpeech(id: number): void {
    if (
      this.mode !== "assistant" ||
      id !== this.utteranceId ||
      this.state !== "speaking"
    ) {
      return;
    }
    this.clearAssistantResponseTimer();
    if (!this.tts || this.assistantSpeechChars === 0) {
      this.tts?.close();
      this.tts = null;
      this.sendMsg({ type: "utterance_end", utteranceId: id });
      this.setState("listening");
      this.bumpIdle();
      return;
    }
    this.tts.flush();
  }

  private resetAssistantSpeech(id: number): void {
    if (
      this.mode !== "assistant" ||
      id !== this.utteranceId ||
      this.state !== "speaking"
    ) {
      return;
    }
    this.sendMsg({ type: "audio_reset", utteranceId: id });
    this.tts?.close();
    this.assistantSpeechChars = 0;
    this.spokenText = "";
    this.tts = this.openTts(id, Date.now(), this.assistantTtsLanguageCode);
    this.armAssistantResponseTimer(id);
  }

  private speakAssistantResponse(
    id: number,
    rawText: string,
    languageCode = this.assistantTtsLanguageCode,
  ): void {
    this.startAssistantSpeech(id, languageCode);
    const chunker = new SentenceChunker();
    const sentences = [...chunker.push(rawText), ...chunker.finish()];
    for (const sentence of sentences.length > 0 ? sentences : [rawText]) {
      this.appendAssistantSpeech(id, sentence);
    }
    this.finishAssistantSpeech(id);
  }

  private seq = 0;

  private toTtsLanguageCode(language: "en" | "te" | undefined): VoiceTtsLanguageCode {
    return language === "en" ? "en-IN" : language === "te" ? "te-IN" : this.assistantTtsLanguageCode;
  }

  /** §4.3 cancellation map, server side. */
  private interrupt(clientUtteranceId: number, notifyClient = false): void {
    if (clientUtteranceId !== this.utteranceId) return; // stale interrupt
    this.log(`interrupt utterance ${clientUtteranceId}`);
    if (notifyClient) {
      this.sendMsg({
        type: "turn_cancelled",
        utteranceId: clientUtteranceId,
        reason: "barge_in",
      });
    }
    this.cancelWork();
    // Truncated turn goes into history so the model knows it was cut off.
    if (this.spokenText) this.history.push({ role: "assistant", content: `${this.spokenText}…` });
    this.utteranceId++; // invalidate anything still in flight
    this.setState("listening");
    this.bumpIdle();
  }

  private cancelWork(): void {
    this.clearAssistantResponseTimer();
    this.llmAbort?.abort();
    this.llmAbort = null;
    this.tts?.close(); // closing IS the TTS cancel
    this.tts = null;
  }

  private setState(value: SessionState): void {
    if (this.state === value) return;
    this.state = value;
    this.sendMsg({ type: "state", value });
  }

  private sendMsg(msg: ServerMsg): void {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private bumpIdle(): void {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.expire("session_idle"), CONFIG.sessionIdleMs);
  }

  private expire(code: string): void {
    this.sendMsg({ type: "error", code, message: "session ended" });
    this.ws.close(1000);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearSttWatchdog();
    this.clearAssistantFinalizeTimer();
    this.clearAssistantResponseTimer();
    this.pendingAssistantTranscript = "";
    this.activeAssistantTranscript = "";
    clearTimeout(this.idleTimer);
    clearTimeout(this.maxTimer);
    this.cancelWork();
    this.stt.close();
  }
}
