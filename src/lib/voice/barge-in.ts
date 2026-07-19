// Client-side barge-in VAD (Silero via @ricky0123/vad-web, all in-browser).
// The VAD runs for the whole session but the CALLER gates on state — it only
// acts while the assistant is speaking. End-of-speech detection in listening
// state belongs to Sarvam's server VAD alone (two arbiters would fight).
// Tuning knobs (raise threshold if ambient noise causes false barge-ins;
// lower them if real interruptions are missed):
const POSITIVE_SPEECH_THRESHOLD = 0.8;
const MIN_SPEECH_MS = 250;

export async function armBargeIn(
  stream: MediaStream,
  audioContext: AudioContext,
  onSpeechStart: () => void,
): Promise<() => void> {
  // Lazy import — ONNX/WASM (~1-2MB) loads only when a voice session starts.
  // ponytail: model/wasm assets come from the package's default CDN; self-host
  // under public/vad/ (baseAssetPath/onnxWASMBasePath) if CSP or offline matters.
  const { MicVAD } = await import("@ricky0123/vad-web");
  const vad = await MicVAD.new({
    // Reuse the session's echo-cancelled mic stream; pause/resume are no-ops
    // so the VAD never stops tracks the capture pipeline still needs.
    getStream: async () => stream,
    pauseStream: async () => {},
    resumeStream: async () => stream,
    audioContext,
    baseAssetPath: "/vad/",
    onnxWASMBasePath: "/vad/",
    model: "v5",
    startOnLoad: false,
    ortConfig: (ort) => {
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
    },
    // RealStart = validated speech (respects minSpeechMs); plain onSpeechStart
    // fires on misfires too and would cause false barge-ins.
    onSpeechRealStart: onSpeechStart,
    positiveSpeechThreshold: POSITIVE_SPEECH_THRESHOLD,
    minSpeechMs: MIN_SPEECH_MS,
  });
  await vad.start();
  return () => {
    void vad.destroy();
  };
}
