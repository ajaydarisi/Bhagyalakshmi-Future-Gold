# T0-2 — A clean STT close (code 1000) silently deafens the session forever

| | |
|---|---|
| **Severity** | critical |
| **Confidence** | `verified` |
| **Effort** | S |
| **Category** | robustness |
| **File** | `voice-agent/src/providers/sarvam-stt.client.ts:79-87` |
| **Sequencing** | **Do this before T0-3.** See *Why this order matters*. |

## Symptom

Mid-conversation the assistant stops hearing the user. The socket stays open, the UI still says
"listening", and nothing is logged. The session sits mute until the 120s idle timer kills it, at which
point the voice panel disappears with no explanation. Reproducible on any session long enough for
Sarvam to recycle the STT socket.

## Verified root cause

`voice-agent/src/providers/sarvam-stt.client.ts:9`:

```ts
const RETRYABLE = new Set([1001, 1006, 1011]); // per Sarvam streaming guide
```

and `:79-87`:

```ts
ws.on("close", (code) => {
  if (this.ws !== ws || this.closed) return;
  this.ws = null;
  if (RETRYABLE.has(code)) {
    this.scheduleRetry();
  } else if (code !== 1000) {
    this.fail(new Error(`STT socket closed (${code})`));
  }
});
```

**Close code 1000 takes neither branch.** `this.ws` is set to `null` and then nothing happens:

- no reconnect (`1000 ∉ RETRYABLE`),
- no `fail()` (guarded by `code !== 1000`),
- no `logEvent`, no `"fatal"` emission, no client-visible `error` frame.

`sendAudio` then early-returns forever, because `:120-127`:

```ts
sendAudio(pcm: Buffer): void {
  const ws = this.ws;
  if (
    ws?.readyState !== WebSocket.OPEN ||
    isSttAudioBackpressured(ws.bufferedAmount)
  ) {
    return;
  }
```

`this.ws` is `null`, so every frame is dropped. The session is deaf.

The cascade that makes it invisible: with no audio reaching Sarvam there are no VAD events, so the STT
watchdog never arms — it is keyed on `END_SPEECH` (`voice-agent/src/session/voice-session.ts:90`):

```ts
if (signal !== "END_SPEECH" || this.state !== "listening") return;
```

So the watchdog's 5s flush and 3s spoken re-prompt (the designed recovery for "we heard nothing") are
both unreachable. The only thing that eventually fires is `sessionIdleMs`
(`voice-agent/src/common/config.ts:21`, default 120s) → `expire("session_idle")` → the client's
`stop()` (`use-voice-session.ts:400`), which resets to `idle` and hides the panel.

**Why 1000 is reachable, not theoretical:** a WebSocket server closing an idle or
maximum-duration session sends `1000 Normal Closure` — that is the correct code for it. And
`docs/voice-assistant-build-plan.md:503` lists **"STT max session duration / idle timeout"** among the
facts explicitly marked *UNVERIFIED*. So this is precisely the provider behaviour nobody measured, and
`sessionMaxMs` defaults to 600s — ten minutes of session against an unmeasured provider socket lifetime.

## Why the obvious fix is wrong

Do **not** just add `1000` to the `RETRYABLE` set. That set is documented as "per Sarvam streaming
guide" and describes *transport* failures. `close(1000)` is also what **our own** `close()` sends
(`:146`), and what a deliberate teardown looks like. Adding it to `RETRYABLE` blurs a documented
provider contract with our own lifecycle.

The distinction that actually matters is already available: `this.closed`. It is set to `true` by
`close()` (`:143`) and by `fail()` (`:111`), and the handler's first line already returns early when it
is set. So by the time control reaches the branch, **a 1000 close is always provider-initiated** —
which is exactly the case we want to recover from.

## The change

`voice-agent/src/providers/sarvam-stt.client.ts`, close handler:

```ts
    ws.on("close", (code) => {
      if (this.ws !== ws || this.closed) return;
      this.ws = null;
      if (RETRYABLE.has(code)) {
        this.scheduleRetry();
      } else if (code !== 1000) {
        this.fail(new Error(`STT socket closed (${code})`));
      }
    });
```

becomes:

```ts
    ws.on("close", (code) => {
      if (this.ws !== ws || this.closed) return;
      this.ws = null;
      // `this.closed` already absorbed our own close(); a 1000 reaching here is
      // provider-initiated (idle/max-duration recycle) and must be reconnected —
      // silently dropping it leaves the session permanently deaf.
      if (RETRYABLE.has(code) || code === 1000) {
        this.scheduleRetry();
      } else {
        this.fail(new Error(`STT socket closed (${code})`));
      }
    });
```

Note the `else` is now unconditional: every non-retryable code fails loudly instead of some codes
falling through to nothing. That closes the whole class of bug, not just code 1000.

### Also add the missing reconnect log

An STT reconnect is currently invisible — `scheduleRetry` (`:94-107`) logs nothing, so ~0.5–8s of
dropped audio leaves no trace. `SttClient` has no logger, but it is an `EventEmitter` and
`VoiceSession` already subscribes to `"transcript"`, `"vad"` and `"fatal"`. Add a fourth event rather
than threading a logger in:

In `scheduleRetry`, immediately before `this.retryTimer = setTimeout(...)`:

```ts
    this.emit("reconnecting", delay);
```

In `voice-agent/src/session/voice-session.ts`, alongside the existing `this.stt.on(...)` handlers in
the constructor (after the `"vad"` handler, before `"fatal"`):

```ts
    this.stt.on("reconnecting", (delayMs: number) => {
      this.log(`STT reconnecting in ${delayMs}ms — audio dropped until reconnect`);
    });
```

`this.log` routes through `voice.gateway.ts:85-90`, whose level regex already matches `/timeout|failed|
backpressure|closing/i` — it will not match "reconnecting", so this lands at `info`. That is correct:
a single reconnect is normal, a burst of them is what you want to see on a dashboard. (T3 promotes this
to a structured field; leave it as `log()` here to keep the diff minimal.)

## Blast radius

Callers of `SttClient`: only `voice-agent/src/session/voice-session.ts:58`
(`new SttClient(languageCode)`) and the test double in `voice-agent/tests/voice-session.test.ts`.
Adding a new emitted event is additive — the test double does not need to emit it, and `EventEmitter`
tolerates an event with no listener. `scheduleRetry`'s existing exhaustion path
(`if (this.backoffMs > 8000) this.fail(...)`, `:96-99`) still bounds total retries, so a permanently
dead provider socket now surfaces as `stt_failed` instead of silence — which is the intended
behaviour per the build plan's Phase 6 failure matrix.

## Acceptance criteria

1. A provider-initiated `close(1000)` triggers a reconnect, and audio flows again afterwards.
2. Our own `close()` still closes cleanly with no reconnect attempt (verified by session teardown not
   logging `STT reconnecting`).
3. A non-retryable, non-1000 code still produces `stt_failed` on the client.
4. Repeated provider closes eventually exhaust backoff and emit `"fatal"` rather than looping forever.
5. All 12 existing `voice-agent` tests still pass.

## Add this test

In `voice-agent/tests/voice-session.test.ts`, using the existing fake-`stt` dependency seam
(`VoiceSessionDependencies.stt`, declared at `voice-agent/src/session/voice-session.ts:20`):

> A clean provider close schedules a reconnect instead of going silent.

The cheapest true assertion is at the `SttClient` level rather than the session level: instantiate
`SttClient`, stub its socket, emit `close(1000)`, and assert a `"reconnecting"` event fires and no
`"fatal"` is emitted. If stubbing `ws` is awkward, assert the inverse invariant at minimum — that
`close(1000)` does **not** leave `this.ws === null` with no timer pending.

## Verification

```bash
cd voice-agent && npm test && npm run typecheck && npm run build
```

Live check against the real provider (this is the check nobody has run — it also answers the build
plan's open question about STT socket lifetime):

```bash
cd voice-agent && npm run dev
# open a session, stay connected past SESSION_MAX_SECONDS/2 with intermittent speech,
# and watch stdout for `STT reconnecting` followed by continued transcripts.
```

Record the observed provider socket lifetime in `docs/voice-assistant-production.md` — it closes an
UNVERIFIED item in `docs/voice-assistant-build-plan.md:503`.

## Why this order matters

**T0-2 must land before T0-3.** If a suspended-then-resumed `AudioContext` (T0-3) is what causes the
long gap in uplink audio that makes Sarvam idle-close the socket, then fixing T0-3 first stops the
trigger from occurring in staging — hiding T0-2 until it fires in production on a slow network instead.
Fix the recovery path first, then remove the trigger.

## Rollback

Revert both hunks. The pre-existing behaviour returns (deaf session), so do not roll back without
re-planning.
