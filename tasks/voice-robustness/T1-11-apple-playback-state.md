# T1-11 — On Apple devices the session never enters `speaking`, so there is no Interrupt button for the whole reply

| | |
|---|---|
| **Severity** | medium |
| **Confidence** | `verified-code` / **`unverified-premise`** — see the gate below |
| **Effort** | S (~6 lines) |
| **Category** | ux |
| **File** | `src/lib/voice/audio-player.ts` |
| **Sequencing** | **After T0-1** — the iOS app cannot be tested at all until the microphone permission exists. |

## GATE — verify this premise before writing code

The whole task rests on one environmental assumption:

> On the target Apple browsers/WebViews, `MediaSource` is unavailable or `MediaSource.isTypeSupported("audio/mpeg")`
> is `false`, so `useMse` is `false` and the fallback path runs.

`src/lib/voice/audio-player.ts:16-17`:

```ts
  private readonly useMse =
    typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg");
```

**Check it on a real device before doing anything else.** iOS Safari's MediaSource story has changed
across versions (`ManagedMediaSource` exists on newer iOS), so this must be measured, not assumed. In
Safari and in the Capacitor iOS WebView, run:

```js
typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg")
```

- **`false`** → the premise holds. Proceed; this is a real, every-reply bug on every Apple device.
- **`true`** → Apple uses the MSE path like Chrome. The bug then only affects the narrow set of browsers
  with no MediaSource at all. **Downgrade to `low`, and fix it anyway** — the code defect below is real
  regardless of who hits it, and the fix is six lines.

Record the measured result in the PR description either way. It also settles a question the build plan left
open at `docs/voice-assistant-build-plan.md:503`.

## Symptom (when the premise holds)

An iPhone/iPad customer asks a question. The reply then plays for 5–10 seconds while the widget header
reads **"listening"** and shows the "speak now" hint. The **Interrupt** button is never offered for the
entire reply. The customer talks over the assistant with no way to stop it and no indication it is still
talking.

## Verified root cause (code defect — confirmed independent of the premise)

On the fallback path, **playback does not begin until the whole utterance has been decoded.**
`src/lib/voice/audio-player.ts:69-97`, `endUtterance()`:

```ts
    } else if (this.fallbackCtx && this.fallbackChunks.length > 0) {
      const total = this.fallbackChunks.reduce((n, c) => n + c.length, 0);
      const all = new Uint8Array(total);
      ...
      void this.fallbackCtx
        .decodeAudioData(all.buffer.slice(0))
        .then((buffer) => {
          if (!this.fallbackCtx) return;
          ...
          this.fallbackSource = source;
          source.start();
        })
        .catch(() => this.handlePlaybackError());
    }
```

`fallbackSource` is assigned only inside the `.then`. And `playing` is derived from it (`:24-26`):

```ts
  get playing(): boolean {
    return this.audio ? !this.audio.paused && !this.audio.ended : this.fallbackSource !== null;
  }
```

So for the entire decode window, `playing` is **`false`**.

That breaks the one guard that keeps the UI honest. `src/hooks/use-voice-session.ts:344-348`:

```ts
          case "state":
            serverStateRef.current = msg.value;
            if (msg.value === "listening" && player.playing) break;
            setUiState(msg.value);
            break;
```

The server sends `utterance_end` and `state: listening` from the **same** TTS `onDone` tick
(`voice-agent/src/session/voice-session.ts:223-229`):

```ts
      onDone: () => {
        if (id !== this.utteranceId) return;
        this.clearAssistantResponseTimer();
        this.sendMsg({ type: "utterance_end", utteranceId: id });
        this.tts = null;
        this.setState("listening");
```

`utterance_end` → `player.endUtterance()` (`use-voice-session.ts:396-397`) starts the decode; the
immediately-following `state: listening` finds `player.playing === false`, so the guard does not hold and
`uiState` drops to `listening` **before a single sample has been heard**. The Interrupt button only renders
for `voiceState === "speaking"` (`storefront-assistant.tsx:1683`), so it never appears.

### Secondary defect, in the same place

`stopAll()` does not invalidate an in-flight decode. `:101-120`:

```ts
  stopAll(): void {
    this.pending = [];
    this.fallbackChunks = [];
    ...
    if (this.fallbackSource) {
      try {
        this.fallbackSource.stop();
      } catch { /* already stopped */ }
      this.fallbackSource = null;
    }
  }
```

It never clears `fallbackCtx`, and the decode continuation only bails on `if (!this.fallbackCtx) return`.
So a barge-in landing **inside** the decode window would let the cancelled utterance start playing anyway —
which becomes reachable precisely once the fix above makes barge-in possible during that window. Fix both
together or the first fix creates the second bug.

## The change

`src/lib/voice/audio-player.ts`:

**1. Add the flag** beside the other private fields (`:12-15`):

```ts
  private fallbackDecoding = false;
```

**2. Set and clear it** in `endUtterance`'s fallback branch:

```ts
      this.fallbackChunks = [];
+     this.fallbackDecoding = true;
      void this.fallbackCtx
        .decodeAudioData(all.buffer.slice(0))
        .then((buffer) => {
+         this.fallbackDecoding = false;
          if (!this.fallbackCtx) return;
          ...
        })
-       .catch(() => this.handlePlaybackError());
+       .catch(() => {
+         this.fallbackDecoding = false;
+         this.handlePlaybackError();
+       });
```

**3. Include it in `playing`:**

```ts
   get playing(): boolean {
-    return this.audio ? !this.audio.paused && !this.audio.ended : this.fallbackSource !== null;
+    return this.audio
+      ? !this.audio.paused && !this.audio.ended
+      // Decoding counts as playing: on the fallback path audio is inevitable but
+      // not yet audible, and the caller uses this to decide whether the UI may
+      // leave the "speaking" state.
+      : this.fallbackDecoding || this.fallbackSource !== null;
   }
```

**4. Make `stopAll` invalidate the decode:**

```ts
   stopAll(): void {
     this.pending = [];
     this.fallbackChunks = [];
+    this.fallbackDecoding = false;
+    // Nulling the context is what makes the in-flight decodeAudioData
+    // continuation bail; beginUtterance re-assigns it immediately after
+    // calling stopAll, so this is safe.
+    this.fallbackCtx = null;
     ...
```

**5. Confirm the re-assignment ordering.** `beginUtterance` (`:28-58`) calls `this.stopAll()` on its first
line and then sets `this.fallbackCtx = ctx` in the else branch (`:56`). So nulling in `stopAll` is safe —
**read those two functions and confirm before landing**, because if any future caller invokes `stopAll`
without a following `beginUtterance`, the fallback path would be permanently dead.

## Why the state guard, not the render gate

An alternative would be to render Interrupt for `listening` too, or to have the server delay
`state: listening`. Both are worse:

- Rendering Interrupt during genuine `listening` would let the customer "interrupt" silence.
- Delaying the server's state change would mean the server modelling client-side decode latency it cannot
  observe — and it would slow the MSE path for no reason.

The guard at `use-voice-session.ts:346` already expresses the right idea ("do not go idle while audio is
still playing"); it is `playing` that is under-reporting. Fix the reporter.

## Blast radius

`VoicePlayer` is used only by `src/hooks/use-voice-session.ts` (`:233-241`). `playing` has exactly two
readers: the `state` guard (`:346`) and the barge-in caller (`:245`):

```ts
      armBargeIn(capture.stream, ctx, () => {
        if (serverStateRef.current === "speaking" || player.playing) interrupt();
      })
```

Widening `playing` therefore **also** makes client-side barge-in fire during the decode window — which is
the desired behaviour and is exactly why fix (4) is mandatory in the same change.

The MSE path (`this.audio` branch) is untouched, so Chrome/Android behaviour cannot regress.

## Acceptance criteria

1. On an Apple device (or with MSE force-disabled, see below): the widget shows **"speaking"** for the whole
   reply, including the decode window, and the Interrupt button is present throughout.
2. Pressing Interrupt during the decode window stops the reply and it does **not** start playing afterwards.
3. Speaking during the decode window triggers barge-in and the reply does not start.
4. A decode failure still surfaces `audio_playback_failed` and does not leave the UI stuck in `speaking`.
5. Chrome/Android (MSE path) behaviour is unchanged — verify explicitly.

## How to test without an Apple device

Force the fallback path in a normal browser by stubbing the feature check before the widget mounts:

```js
// in DevTools, before opening the assistant
MediaSource.isTypeSupported = () => false;
```

That exercises every line of the fix. It does **not** substitute for the GATE check above — the gate is
about which real users are affected, not whether the code works.

## Tests to add

`VoicePlayer` is a plain class with no React dependency, so it is directly unit-testable. Add
`tests/unit/voice-player.test.ts` (this is a new file, and it is justified — there is no existing home):

- `playing` is `true` between `endUtterance()` and the decode resolving
- `playing` is `false` before `beginUtterance` and after playback ends
- `stopAll()` during the decode window prevents `source.start()` from ever being called
- a rejected decode clears the flag and invokes the error callback exactly once

Stub `AudioContext` with a fake exposing `decodeAudioData` (a controllable promise), `createBufferSource`
and `destination`. Keep the stub inline in the test file — do not add a mocking library.

## Rollback

Revert all four hunks together. Do **not** revert (1)–(3) while keeping (4), or vice versa: (4) exists to
cover the window that (1)–(3) open.
