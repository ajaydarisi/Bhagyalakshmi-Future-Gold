export interface Capture {
  stream: MediaStream;
  stop(): void;
}

// echoCancellation is load-bearing: without it the mic hears the assistant and
// Phase 5's barge-in VAD would trigger on the assistant's own voice.
export async function startCapture(
  ctx: AudioContext,
  onFrame: (frame: ArrayBuffer) => void,
): Promise<Capture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  });
  try {
    await ctx.audioWorklet.addModule("/worklets/pcm-recorder.worklet.js");
    const source = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, "pcm-recorder");
    node.port.onmessage = (e) => onFrame(e.data as ArrayBuffer);
    source.connect(node);
    node.connect(ctx.destination); // silent output; keeps the worklet processing

    return {
      stream,
      stop() {
        node.port.onmessage = null;
        node.disconnect();
        source.disconnect();
        for (const track of stream.getTracks()) track.stop();
      },
    };
  } catch (error) {
    // getUserMedia succeeded, so release the mic if worklet setup fails.
    for (const track of stream.getTracks()) track.stop();
    throw error;
  }
}
