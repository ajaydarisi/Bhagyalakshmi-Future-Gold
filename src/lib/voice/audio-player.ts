// Plays the server's base64-MP3 chunk stream. Phase 1 finding: chunk
// boundaries fall MID-FRAME, so per-chunk decodeAudioData would crackle —
// MediaSource ('audio/mpeg') treats it as one continuous stream. Safari
// fallback buffers the whole utterance and plays it via decodeAudioData
// (latency hit on Apple devices only).
export class VoicePlayer {
  private audio: HTMLAudioElement | null = null;
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private pending: Uint8Array[] = [];
  private streamEnded = false;
  private fallbackChunks: Uint8Array[] = [];
  private fallbackCtx: AudioContext | null = null;
  private fallbackDecoding = false;
  private fallbackSource: AudioBufferSourceNode | null = null;
  private playbackFailed = false;
  private readonly useMse =
    typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg");

  constructor(
    private readonly onPlaybackEnd: () => void,
    private readonly onPlaybackError: () => void = () => {},
  ) {}

  get playing(): boolean {
    // Decoding counts as playing: on the fallback path (no MediaSource, i.e.
    // Safari/iOS) audio is inevitable but not yet audible, and the caller uses
    // this to decide whether the UI may leave "speaking" and whether barge-in
    // should fire. Reporting false there hid the Interrupt button for the whole
    // reply and dropped the UI to "listening" before a single sample was heard.
    return this.audio
      ? !this.audio.paused && !this.audio.ended
      : this.fallbackDecoding || this.fallbackSource !== null;
  }

  beginUtterance(ctx: AudioContext): void {
    this.stopAll();
    this.streamEnded = false;
    this.playbackFailed = false;
    if (this.useMse) {
      const audio = new Audio();
      const ms = new MediaSource();
      this.audio = audio;
      this.mediaSource = ms;
      audio.src = URL.createObjectURL(ms);
      audio.addEventListener("ended", () => this.onPlaybackEnd());
      audio.addEventListener("error", () => {
        if (this.audio === audio) this.handlePlaybackError();
      });
      ms.addEventListener("sourceopen", () => {
        if (this.mediaSource !== ms) return; // stopped meanwhile
        try {
          const sb = ms.addSourceBuffer("audio/mpeg");
          this.sourceBuffer = sb;
          sb.addEventListener("updateend", () => this.drain());
          sb.addEventListener("error", () => this.handlePlaybackError());
          this.drain();
        } catch {
          this.handlePlaybackError();
        }
      });
      void audio.play().catch(() => this.handlePlaybackError());
    } else {
      this.fallbackCtx = ctx;
    }
  }

  pushChunk(bytes: Uint8Array): void {
    if (this.useMse) {
      this.pending.push(bytes);
      this.drain();
    } else {
      this.fallbackChunks.push(bytes);
    }
  }

  endUtterance(): void {
    this.streamEnded = true;
    if (this.useMse) {
      this.drain();
    } else if (this.fallbackCtx && this.fallbackChunks.length > 0) {
      const total = this.fallbackChunks.reduce((n, c) => n + c.length, 0);
      const all = new Uint8Array(total);
      let offset = 0;
      for (const c of this.fallbackChunks) {
        all.set(c, offset);
        offset += c.length;
      }
      this.fallbackChunks = [];
      this.fallbackDecoding = true;
      void this.fallbackCtx
        .decodeAudioData(all.buffer.slice(0))
        .then((buffer) => {
          this.fallbackDecoding = false;
          if (!this.fallbackCtx) return;
          const source = this.fallbackCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(this.fallbackCtx.destination);
          source.onended = () => {
            this.fallbackSource = null;
            this.onPlaybackEnd();
          };
          this.fallbackSource = source;
          source.start();
        })
        .catch(() => {
          this.fallbackDecoding = false;
          this.handlePlaybackError();
        });
    }
  }

  /** Barge-in step 1: local, instant, no round trip. */
  stopAll(): void {
    this.pending = [];
    this.fallbackChunks = [];
    this.fallbackDecoding = false;
    // Nulling the context is what makes an in-flight decodeAudioData
    // continuation bail (it early-returns on a null fallbackCtx), so a barge-in
    // landing inside the decode window cannot start the cancelled utterance.
    // beginUtterance re-assigns fallbackCtx immediately after calling stopAll.
    this.fallbackCtx = null;
    if (this.audio) {
      this.audio.pause();
      URL.revokeObjectURL(this.audio.src);
      this.audio.removeAttribute("src");
      this.audio = null;
    }
    this.mediaSource = null;
    this.sourceBuffer = null;
    if (this.fallbackSource) {
      try {
        this.fallbackSource.stop();
      } catch {
        /* already stopped */
      }
      this.fallbackSource = null;
    }
  }

  private drain(): void {
    const sb = this.sourceBuffer;
    if (!sb || sb.updating || this.mediaSource?.readyState !== "open") return;
    const next = this.pending.shift();
    if (next) {
      try {
        sb.appendBuffer(next as BufferSource);
      } catch {
        this.handlePlaybackError();
      }
    } else if (this.streamEnded) {
      try {
        this.mediaSource.endOfStream();
      } catch {
        /* already ended */
      }
    }
  }

  private handlePlaybackError(): void {
    if (this.playbackFailed) return;
    this.playbackFailed = true;
    this.stopAll();
    this.onPlaybackError();
  }
}
