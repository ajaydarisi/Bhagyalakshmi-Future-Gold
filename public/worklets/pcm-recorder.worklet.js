// Captures mic audio, downsamples from the context rate (usually 48 kHz — do
// not try to force a 16 kHz context, Safari ignores the hint) to 16 kHz PCM
// s16le mono, and posts ~100ms frames to the main thread.
class PcmRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunks = [];
    this.length = 0;
    this.target = Math.round(sampleRate * 0.1); // ~100ms at context rate
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      this.chunks.push(channel.slice());
      this.length += channel.length;
      if (this.length >= this.target) {
        const all = new Float32Array(this.length);
        let offset = 0;
        for (const c of this.chunks) {
          all.set(c, offset);
          offset += c.length;
        }
        this.chunks = [];
        this.length = 0;

        // Linear-interpolation resample to 16 kHz, then float32 -> s16le.
        const ratio = sampleRate / 16000;
        const outLength = Math.floor(all.length / ratio);
        const out = new Int16Array(outLength);
        for (let i = 0; i < outLength; i++) {
          const pos = i * ratio;
          const i0 = Math.floor(pos);
          const frac = pos - i0;
          const s = all[i0] * (1 - frac) + (all[i0 + 1] !== undefined ? all[i0 + 1] : all[i0]) * frac;
          out[i] = Math.max(-32768, Math.min(32767, Math.round(s * 32767)));
        }
        this.port.postMessage(out.buffer, [out.buffer]);
      }
    }
    return true;
  }
}

registerProcessor("pcm-recorder", PcmRecorder);
