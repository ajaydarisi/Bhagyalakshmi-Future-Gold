import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoicePlayer } from "@/lib/voice/audio-player";

/**
 * These cover the NO-MediaSource fallback path (Safari/iOS and the Capacitor iOS
 * WebView), where the whole utterance is buffered and decoded before playback.
 * `playing` must report true across that decode window: the hook uses it to
 * decide whether the UI may leave "speaking" and whether barge-in may fire, so
 * reporting false hid the Interrupt button for the entire reply.
 */

type DeferredDecode = {
  resolve: (buffer: AudioBuffer) => void;
  reject: (error: Error) => void;
};

function createFakeContext() {
  const decodes: DeferredDecode[] = [];
  const started: unknown[] = [];
  const source = {
    buffer: null as unknown,
    connect: vi.fn(),
    start: vi.fn(() => started.push(source)),
    stop: vi.fn(),
    onended: null as null | (() => void),
  };
  const ctx = {
    destination: {},
    createBufferSource: vi.fn(() => source),
    decodeAudioData: vi.fn(
      () =>
        new Promise<AudioBuffer>((resolve, reject) => {
          decodes.push({
            resolve: resolve as (buffer: AudioBuffer) => void,
            reject,
          });
        }),
    ),
  };
  return { ctx: ctx as unknown as AudioContext, decodes, source, started };
}

describe("VoicePlayer fallback playback (no MediaSource)", () => {
  beforeEach(() => {
    // Force the fallback branch regardless of the host environment.
    vi.stubGlobal("MediaSource", undefined);
  });

  it("reports playing across the decode window, before any audio is audible", async () => {
    const { ctx, decodes } = createFakeContext();
    const player = new VoicePlayer(() => {}, () => {});

    expect(player.playing).toBe(false);

    player.beginUtterance(ctx);
    player.pushChunk(new Uint8Array([1, 2, 3, 4]));
    expect(player.playing).toBe(false); // nothing decoding yet

    player.endUtterance();
    expect(player.playing).toBe(true); // decode in flight — this is the fix

    decodes[0]?.resolve({ duration: 1 } as AudioBuffer);
    await Promise.resolve();
    await Promise.resolve();
    expect(player.playing).toBe(true); // now genuinely playing
  });

  it("does not start the cancelled utterance when barge-in lands mid-decode", async () => {
    const { ctx, decodes, source } = createFakeContext();
    const player = new VoicePlayer(() => {}, () => {});

    player.beginUtterance(ctx);
    player.pushChunk(new Uint8Array([1, 2, 3, 4]));
    player.endUtterance();
    expect(player.playing).toBe(true);

    player.stopAll(); // barge-in inside the decode window
    expect(player.playing).toBe(false);

    // The decode still settles; it must not reach source.start().
    decodes[0]?.resolve({ duration: 1 } as AudioBuffer);
    await Promise.resolve();
    await Promise.resolve();
    expect(source.start).not.toHaveBeenCalled();
    expect(player.playing).toBe(false);
  });

  it("clears the decoding flag and reports the error once when decode fails", async () => {
    const { ctx, decodes } = createFakeContext();
    const onPlaybackError = vi.fn();
    const player = new VoicePlayer(() => {}, onPlaybackError);

    player.beginUtterance(ctx);
    player.pushChunk(new Uint8Array([1, 2, 3, 4]));
    player.endUtterance();

    decodes[0]?.reject(new Error("corrupt mp3"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(onPlaybackError).toHaveBeenCalledTimes(1);
    expect(player.playing).toBe(false);
  });
});
