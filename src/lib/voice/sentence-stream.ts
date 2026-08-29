const SENTENCE_BOUNDARY = /(?<=[.?!।])\s+/;
const SOFT_CHUNK_MIN = 80;
const SOFT_CHUNK_MAX = 180;

export class SentenceStream {
  private buffer = "";

  push(delta: string): string[] {
    this.buffer += delta;
    const completed: string[] = [];
    const sentences = this.buffer.split(SENTENCE_BOUNDARY);
    if (sentences.length > 1) {
      this.buffer = sentences.pop() ?? "";
      completed.push(...sentences.map((value) => value.trim()).filter(Boolean));
    }

    // A provider commonly yields punctuation as the last token in a chunk.
    // That is already a safe sentence boundary; do not wait for the next token
    // (or the final rich-result event) before starting TTS.
    if (/[.?!।]\s*$/.test(this.buffer)) {
      const sentence = this.buffer.trim();
      this.buffer = "";
      if (sentence) completed.push(sentence);
    }

    while (this.buffer.length >= SOFT_CHUNK_MAX) {
      const boundary = this.buffer.lastIndexOf(" ", SOFT_CHUNK_MAX);
      if (boundary < SOFT_CHUNK_MIN) break;
      completed.push(this.buffer.slice(0, boundary).trim());
      this.buffer = this.buffer.slice(boundary + 1);
    }
    return completed;
  }

  finish(): string[] {
    const tail = this.buffer.trim();
    this.buffer = "";
    return tail ? [tail] : [];
  }

  reset(): void {
    this.buffer = "";
  }
}
