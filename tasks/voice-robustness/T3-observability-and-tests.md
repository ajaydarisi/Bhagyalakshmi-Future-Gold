# T3 — Make the voice agent debuggable: structured latency, disconnect attribution, correlation, TTS-leg tests

| | |
|---|---|
| **Severity** | medium |
| **Confidence** | `verified` |
| **Effort** | M total, S per item |
| **Files** | `voice-agent/src/session/voice-session.ts`, `voice-agent/src/gateway/voice.gateway.ts`, `src/app/api/assistant/chat/route.ts`, `voice-agent/tests/voice-session.test.ts` |
| **Sequencing** | Independent, but doing T3-1 **first** makes every other task's acceptance check measurable instead of anecdotal. Consider it the real starting point. |

## The gap

`docs/voice-assistant-production.md:139-155` already specifies the dashboard the business wants:

> first-sentence and first-audio latency · assistant time-to-first-delta and time from first delta to first
> TTS sentence · session duration and unexpected disconnect rate · connection rejections grouped by reason ·
> STT/TTS/timeout/backpressure/heartbeat failures

and the alerts that depend on it (p95 first-audio > 6s for 10 minutes; assistant timeout rate > 2%).

**The code cannot feed any of the latency ones.** For contrast, Sarvam's embed emits **21** telemetry
events — the handshake and socket lifecycle (`signed_url_requested` / `_received` / `_failed`,
`ws_connecting` / `ws_connected` / `ws_disconnected` / `ws_error`), the session
(`session_started` / `session_ended`, `interaction_connected`, `state_changed`), the audio path
(`first_audio_packet_sent`, `first_audio_packet_received`, `audio_interface_started` / `_stopped`), user
actions (`user_interrupted`, `user_muted` / `_unmuted`), the network (`network_online` / `_offline`) and
`error` — plus a `sessionEndInitiator` of `user` | `network` | `error` | `agent`. Verified in
`sarvam-convai-embed@1.0.19`; an earlier draft of this file named two of them slightly wrong
(`first_audio_sent` / `first_audio_received`).

Do **not** port 21 events. The point of the comparison is the *shape*: every event is a name plus typed
fields, so latency is queryable without parsing prose. The four items below are the subset BFG's own
production doc already asks for.

The logger itself is good. `voice-agent/src/common/logger.ts:5-16` emits structured JSON with a scalar-only
field allowlist:

```ts
export function logEvent(
  level: LogLevel,
  event: string,
  fields: Record<string, LogValue> = {},
): void {
```

The problem is that the numbers never become fields.

---

## T3-1 — Turn latencies are free text inside a log message

**File:** `voice-agent/src/session/voice-session.ts:219`, `:285`

```ts
        if (firstAudio) {
          firstAudio = false;
          this.log(`turn ${id}: first audio +${Date.now() - t0}ms`);
        }
```

```ts
      if (firstSentence) {
        firstSentence = false;
        this.log(`turn ${id}: first sentence +${Date.now() - t0}ms`);
      }
```

`this.log` is the closure built in the gateway (`voice.gateway.ts:85-90`):

```ts
    const log = (message: string) => {
      const level: LogLevel = /error|fatal|failed|timeout|backpressure|closing/i.test(message)
        ? "warn"
        : "info";
      logEvent(level, "session_activity", { sessionId: id, mode, message });
    };
```

So every latency lands as `{"event":"session_activity","message":"turn 4: first audio +1832ms"}`. Computing
a p95 from that requires regex-parsing log text — which is why the alert in the production doc does not
exist.

**Change.** Give `VoiceSession` a structured emitter alongside `log`, rather than replacing `log` (it is
used for ~20 human-readable lines that are genuinely prose).

The clean seam: the gateway already constructs `log` and closes over `id` and `mode`. Construct a second
closure the same way and pass both into the constructor:

```ts
    const logMetric = (event: string, fields: Record<string, LogValue> = {}) =>
      logEvent("info", event, { sessionId: id, mode, ...fields });
```

`VoiceSession`'s constructor signature is `(ws, log, mode, languageCode, dependencies)` — adding a
parameter means touching the test call sites. Prefer adding it to the existing
`VoiceSessionDependencies` object (`voice-agent/src/session/voice-session.ts:19-24`) with a no-op default,
so **no existing test changes**:

```ts
export interface VoiceSessionDependencies {
  stt?: SttClient;
  openTts?: typeof openTtsUtterance;
  assistantSettleMs?: number;
  assistantResponseTimeoutMs?: number;
  logMetric?: (event: string, fields?: Record<string, LogValue>) => void;
}
```

Then replace the two latency lines:

```ts
-         this.log(`turn ${id}: first audio +${Date.now() - t0}ms`);
+         this.logMetric("turn_first_audio", { utteranceId: id, ms: Date.now() - t0 });
```

```ts
-       this.log(`turn ${id}: first sentence +${Date.now() - t0}ms`);
+       this.logMetric("turn_first_sentence", { utteranceId: id, ms: Date.now() - t0 });
```

Add a third at the end of a turn, in `openTts`'s `onDone` (`:223-230`), emitting total turn duration.

**Add the two metrics the production doc names that have no source at all:**
- `ws_connected` at the end of `handleConnection`, with the time from socket open to first
  `state: listening`.
- `stt_reconnecting` — T0-2 adds this as a `log()` call; if T0-2 has landed, promote it to `logMetric` here.

**Do not** log transcripts, tokens, audio, or `req.url` (it carries the token). The scalar-only signature of
`logEvent` is a guard — keep it. See `01-CONTEXT-comparison-vs-sarvam.md` §"What is already good" #6.

---

## T3-2 — `session_disconnected` records no close code, so disconnects are unattributable

**File:** `voice-agent/src/gateway/voice.gateway.ts:127-143`

```ts
  handleDisconnect(ws: WebSocket): void {
    const metadata = this.sessionMetadata.get(ws);
    ...
    if (metadata) {
      logEvent("info", "session_disconnected", {
        sessionId: metadata.id,
        mode: metadata.mode,
        durationMs: Date.now() - metadata.startedAt,
        activeSessions: this.sessions.size,
      });
    }
```

No close code and no reason. "It cut me off" is therefore unanswerable: a clean user stop, a network drop, a
heartbeat termination (`ws.terminate()` at `:174`) and a server-side `expire()` are all indistinguishable in
the logs.

**Change.** Nest's `OnGatewayDisconnect` may not surface the close code, so bind it at the source. In
`handleConnection`, where the other `ws.on(...)` handlers are registered, capture it:

```ts
    ws.on("close", (code, reason) => {
      const metadata = this.sessionMetadata.get(ws);
      if (metadata) metadata.closeCode = code;
    });
```

Add `closeCode?: number` and `endInitiator?: string` to the `sessionMetadata` value type (`:29-32`) and
include both in the `session_disconnected` fields.

For `endInitiator`, copy Sarvam's four-value taxonomy — `user | agent | network | error`. Derive it from
what the service already knows:

| Initiator | Signal |
|---|---|
| `agent` | `expire()` was called (`voice-session.ts:548`) — set a flag there |
| `network` | heartbeat `ws.terminate()` (`voice.gateway.ts:174`) |
| `error` | a `4xxx` close, or `fail()`/`stt_failed` fired |
| `user` | anything else — a clean `1000` with none of the above |

Do **not** log `reason` verbatim if it can carry client-supplied text — the client sets close reasons
(`use-voice-session.ts:83`, `:286`). Log the numeric code and your own derived initiator only.

---

## T3-3 — No correlation id across the two services

**File:** `src/app/api/assistant/chat/route.ts:928` (the `[assistant.chat]` log line)

The split topology (see `01-CONTEXT-comparison-vs-sarvam.md`) means one customer turn produces log lines in
**two** systems — Render (voice service) and Vercel (chat route) — with **nothing** joining them. And the
chat route's log does not even record whether a turn was voice or typed, so "voice feels slow" cannot be
separated from "chat is slow".

**Change, in two parts:**

1. **Cheap and immediately useful:** add `source: payload.source` to the `[assistant.chat]` log line. Use
   the `isVoiceTurn` constant from T1-2. One field, and it makes every voice-vs-typed latency question
   answerable from Vercel logs alone. **Do this even if you skip part 2.**

2. **Full correlation:** the token's `jti` is already a per-session UUID
   (`src/app/api/voice/token/route.ts:72`) that both sides possess — the storefront mints it, the voice
   service verifies and holds it (`voice-agent/src/auth/session-token.ts:47`). Log it on the voice side (as
   a session id field), and have the client include it in the `/api/assistant/chat` request so the route can
   log it too.

   Two cautions. **First: `jti` is currently the replay key** (`voice.gateway.ts:152-160`) — it is not a
   secret, but do confirm that logging it creates no replay exposure given tokens are single-use and expire
   in 60s. **Second:** the client would need to retain the token beyond socket setup, where today it is
   used once and dropped (`use-voice-session.ts:261-282`). If retaining it feels wrong, generate a separate
   opaque session id in `startVoice()`, send it on the WS query string and in the chat request, and log it
   on both sides — that is cleaner and avoids touching the auth token entirely. **Prefer this.**

---

## T3-4 — Tests never drive the TTS handlers, so the whole audio-return leg is uncovered

**File:** `voice-agent/tests/voice-session.test.ts`

The suite is genuinely good — 12 passing cases covering the settle window, VAD-blip-vs-real-transcript,
stale `speak` rejection, generation reset, barge-in invalidation, and Telugu scrubbing. It injects a fake
`openTts` through `VoiceSessionDependencies`.

But the fake is only ever used to *observe* what was sent **to** TTS. Nothing calls the handlers TTS invokes
**back**: `onAudio`, `onDone`, `onError` (declared `voice-agent/src/providers/sarvam-tts.client.ts:13-17`,
consumed at `voice-session.ts:199-242`). So these are untested:

| Untested branch | Location | Why it matters |
|---|---|---|
| client backpressure → `audio_backpressure`, end audio, return to `listening` | `voice-session.ts:202-216` | fires on a slow mobile connection; ends the reply mid-sentence |
| `onError` → `tts_failed` + `utterance_end` + `listening` | `:231-241` | a Sarvam TTS outage; the documented degradation is "text stays visible" |
| `onDone` → `utterance_end` then `listening`, and `bumpIdle` | `:223-230` | the normal path; also the exact sequencing T1-11 depends on |
| `seq` numbering across an utterance | `:221` | client drops `audio` frames by `utteranceId`, and `seq` is reset inside `openTts` (`:198`) |

**Change.** Extend the existing fake `openTts` so the test can invoke the handlers it was given, then add
four cases:

1. `onAudio` with `ws.bufferedAmount` stubbed above `CONFIG.maxSocketBufferedBytes` → asserts the
   `audio_backpressure` error frame, `utterance_end`, and a return to `listening`.
2. `onError` → asserts `tts_failed`, `utterance_end`, `listening`, and that `this.tts` is cleared.
3. `onDone` → asserts `utterance_end` precedes `state: listening` (this is the ordering
   `use-voice-session.ts:346`'s guard depends on, and the bug T1-11 fixes).
4. Handlers invoked **after** a barge-in bumped `utteranceId` → asserts every one is ignored via the
   `if (id !== this.utteranceId) return` guards at `:201`, `:224`, `:232`.

Case 4 is the highest-value one: it pins the staleness invariant that makes barge-in safe, and it is
currently protected by nothing but three hand-written guards.

---

## Verification for the whole tier

```bash
cd voice-agent && npm test && npm run typecheck && npm run build
npm run lint && npx tsc --noEmit && npm run test:unit && npm run build
```

Then confirm the log stream is actually queryable — run a real session and check that a single turn produces
parseable events:

```bash
cd voice-agent && npm run dev 2>&1 | grep -E 'turn_first_(audio|sentence)|session_disconnected'
```

Each line must be valid JSON with numeric `ms`, not prose.

## Update the docs when this lands

`docs/voice-assistant-production.md:139-155` describes the dashboard as aspirational. Once T3-1 and T3-2
land, rewrite that section to name the **actual event names and fields** so whoever builds the dashboard has
a contract rather than a wish list. That is the deliverable that makes this tier worth doing.

## Acceptance criteria

1. First-sentence, first-audio and total-turn latency are emitted as structured numeric fields.
2. `session_disconnected` carries a close code and a derived initiator from the four-value taxonomy.
3. The chat route's log line distinguishes voice from typed turns.
4. A p95 first-audio latency alert can be built from the log stream with no text parsing.
5. The four TTS-leg tests pass, bringing the `voice-agent` suite to 16+ cases.
6. No transcript, token, audio payload or `req.url` appears in any log line — re-grep to confirm.
