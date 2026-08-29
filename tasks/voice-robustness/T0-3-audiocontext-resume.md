# T0-3 — AudioContext is never resumed after backgrounding: mic dead while the UI says "listening"

| | |
|---|---|
| **Severity** | high |
| **Confidence** | `verified` |
| **Effort** | S (~6 lines) |
| **Category** | robustness |
| **File** | `src/hooks/use-voice-session.ts` |
| **Sequencing** | **After T0-2.** See T0-2 → *Why this order matters*. |

## Symptom

Mobile (Safari, and both Capacitor WebViews): the user starts a voice session, something backgrounds the
app for a few seconds — an incoming call, a notification tap, switching apps — and on return the widget
still says "listening / speak now" with the mic indicator lit, but **every word goes nowhere**. The
session then sits mute until the 120s idle timer ends it and the panel vanishes with no explanation.

## Verified root cause

`ctx.resume()` is called exactly once, during `start()`, at `src/hooks/use-voice-session.ts:190-199`:

```ts
    const AudioContextConstructor = window.AudioContext;
    let ctx: AudioContext;
    try {
      ctx = new AudioContextConstructor();
      ctxRef.current = ctx;
      await ctx.resume();
    } catch {
      fail("audio_unavailable", generation);
      return;
    }
```

A repo-wide grep confirms there is **no** `visibilitychange`, no `AudioContext.onstatechange`, and no
`bfg:app-resume` listener anywhere in the voice path — the only other `resume()` in `src/` is unrelated.

When the OS suspends the context, the `pcm-recorder` worklet stops being pulled, so
`public/worklets/pcm-recorder.worklet.js` posts no frames, so the `onFrame` callback registered at
`use-voice-session.ts:204-213` never fires and nothing is sent uplink. Meanwhile:

- the WebSocket stays open (the gateway heartbeat is `ws.ping`/`pong`, handled by the browser stack
  itself, not by application audio — `voice-agent/src/gateway/voice.gateway.ts:162-182`),
- `uiState` stays on whatever the server last sent, because state only changes on an inbound frame.

So the UI is confidently wrong. And as in T0-2, zero uplink audio means zero VAD events, which means the
STT watchdog — keyed on `END_SPEECH` at `voice-agent/src/session/voice-session.ts:90` — never arms, so
neither the 5s flush nor the 3s spoken re-prompt can rescue it.

## The change

The repo **already dispatches the exact event needed for this class of WebView bug**. From
`src/components/shared/capacitor-init.tsx:49`:

```ts
        window.dispatchEvent(new CustomEvent("bfg:app-resume"));
```

It is already consumed by `use-auth`, `use-cart` and `use-prefetch` for precisely this purpose. Reuse it
rather than inventing a Capacitor listener inside the voice hook.

Add one effect to `src/hooks/use-voice-session.ts`, next to the existing unmount effect at `:459`
(`useEffect(() => teardown, [teardown]);`):

```ts
  /** iOS/WebView suspend the AudioContext on background; the worklet then stops
   *  producing frames while the socket and UI still look healthy. Resume on the
   *  same signals the rest of the app already uses for WebView wake-up. */
  useEffect(() => {
    const resumeAudio = () => {
      const ctx = ctxRef.current;
      if (ctx && ctx.state === "suspended") void ctx.resume();
    };
    const onVisibility = () => {
      if (!document.hidden) resumeAudio();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("bfg:app-resume", resumeAudio);
    window.addEventListener("focus", resumeAudio);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("bfg:app-resume", resumeAudio);
      window.removeEventListener("focus", resumeAudio);
    };
  }, []);
```

Notes on the specifics, so this is not "improved" into something worse:

- **Guard on `ctx.state === "suspended"`.** Calling `resume()` on a running context is harmless but
  returns a promise; the guard keeps it a no-op in the common case and makes the intent readable.
- **Read `ctxRef.current`, not a captured `ctx`.** The ref is the live handle;
  `releaseResources()` (`:84-86`) nulls it on teardown, so after `stop()` this effect correctly does
  nothing. That is why the dependency array is empty and the effect need not be re-created per session.
- **Three listeners, not one.** `visibilitychange` covers browser tab switches, `bfg:app-resume` covers
  the Capacitor `appStateChange` path, `focus` covers desktop window switching where
  `visibilitychange` may not fire. All three funnel into the same guarded call.
- **Do not add `ctx.onstatechange`.** It fires during normal setup and teardown too and would need its
  own generation guard; the three events above are the actual triggers.

## Blast radius

Purely additive inside the hook. `ctxRef` is already the single source of truth for the live context
(`:46`, assigned `:195`, nulled `:84-86`). No other consumer of `useVoiceSession` changes. The hook's
public return shape is unchanged, so `storefront-assistant.tsx` needs no edit.

## What this does NOT fix (deliberately out of scope)

- **A long background gap still loses the audio spoken during it.** That is unavoidable — the mic was
  suspended. Recovery here means "the mic works again on return", not "nothing was lost".
- **Android audio-focus loss during a phone call** may stop the *track* rather than suspend the context.
  Verify this on a device as part of T0-1's device pass; if the track ends, that is a separate task
  (listen for `MediaStreamTrack.onended` and surface an error state). Do not speculatively add it here.
- **A session suspended past `sessionIdleMs` (120s)** will still be expired by the server. Correct
  behaviour — do not extend the idle timer to compensate.

## Acceptance criteria

1. Desktop Chrome: start a session, switch to another tab for ~10s, return, speak → a transcript
   appears. Before the fix this hangs.
2. Android app (after T0-1): start a session, press Home, wait ~10s, reopen the app, speak → transcript
   appears.
3. iOS Safari: same as (1) with an app switch.
4. After `stop()`, backgrounding and returning does **not** resurrect audio or throw (the ref is null).
5. No new `tsc`/lint errors; existing unit and e2e suites unchanged and passing.

## Verification

```bash
npm run lint && npx tsc --noEmit && npm run test:unit
npx playwright test tests/e2e/assistant.spec.ts --project=chromium
```

Manual, with the voice service running:

```bash
cd voice-agent && npm run dev     # terminal 1
npm run dev                        # terminal 2
```

Then in DevTools during a live session, confirm the mechanism directly:

```js
// while a session is live, before backgrounding
document.dispatchEvent(new Event("visibilitychange"));
```

A tighter check — force the failure state and confirm recovery:

```js
// obtain the context via the AudioContext instance in the page, suspend it, then
// fire the event and assert ctx.state returns to "running".
```

## Rollback

Delete the effect. Reverts to current behaviour.
