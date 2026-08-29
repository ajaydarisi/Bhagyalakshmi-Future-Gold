# T1-5 — A chat-route failure before the first delta strands the voice session in `thinking` for 30 seconds

| | |
|---|---|
| **Severity** | high |
| **Confidence** | `verified` |
| **Effort** | S |
| **Category** | robustness |
| **File** | `src/components/assistant/storefront-assistant.tsx:1229-1249` |
| **Sequencing** | none. Pairs naturally with T1-6 (same failure, different symptom) — do them together. |

## Symptom

The customer speaks, the widget shows "thinking", and then nothing happens for **30 seconds** before an
error appears. The underlying failure — a dropped request, a 500, a retrieval throw — happened in the
first second. The customer has already given up and tapped something else.

## Verified root cause

The voice turn starts TTS **lazily**, on the first answer delta.
`src/components/assistant/storefront-assistant.tsx:1225-1249`:

```ts
        speechStarted = startVoiceSpeaking(utteranceId, responseLocale);
      }
      return speechStarted;
    };
    const answer = await sendMessage(transcript, "voice", utteranceId, {
      onDelta(delta) {
        if (!ensureSpeechStarted()) return;
        for (const sentence of speech.push(delta)) {
          appendVoiceSpeech(sentence, utteranceId);
        }
      },
      onReset() {
        speech.reset();
        if (speechStarted) resetVoiceSpeaking(utteranceId);
      },
    });
    if (answer && ensureSpeechStarted()) {
      for (const sentence of speech.finish()) {
        appendVoiceSpeech(sentence, utteranceId);
      }
      finishVoiceSpeaking(utteranceId);
    } else if (speechStarted) {
      finishVoiceSpeaking(utteranceId);
    }
  }
```

Trace the failure case — `sendMessage` returns falsy **and no delta ever arrived**:

- `answer` is falsy → first branch skipped.
- `speechStarted` is `false` (nothing ever called `ensureSpeechStarted` successfully) → `else if` skipped.
- **So no message at all is sent to the voice service.** No `speak_start`, no `speak_end`, no `interrupt`.

Server side, the turn is still open. `startAssistantTurn`
(`voice-agent/src/session/voice-session.ts:318-325`) already did:

```ts
    this.setState("thinking");
    this.sendMsg({ type: "transcript", utteranceId: id, text: userText });
    this.armAssistantResponseTimer(id);
```

so the only thing that will ever move it is `assistantResponseTimer`, which is
`CONFIG.assistantResponseTimeoutMs` — **30 000ms** by default
(`voice-agent/src/common/config.ts:25-26`). When it finally fires (`:365-389`) it emits
`turn_cancelled`, an `assistant_timeout` error, `utterance_end`, and returns to `listening`.

So an instant client-side failure costs the customer a **full 30-second silent wait**, and the error they
eventually see is `responseTimeout` (`storefront-assistant.tsx:getVoiceErrorMessage`) — which is a lie
about what happened, making the log trail misleading too.

Note the two budgets differ deliberately: the client's own `ASSISTANT_CLIENT_TIMEOUT_MS` is 28s
(`storefront-assistant.tsx:123`) and it re-arms on **every** delta (`:864`, `:883`), so a stream that
produces deltas is not affected by this bug. The bug is specifically the **zero-delta** failure.

## The change

Tell the server the turn is over. The cheapest correct signal already exists and already works for this
exact utterance id.

In the tail of the voice turn function:

```ts
    if (answer && ensureSpeechStarted()) {
      for (const sentence of speech.finish()) {
        appendVoiceSpeech(sentence, utteranceId);
      }
      finishVoiceSpeaking(utteranceId);
    } else if (speechStarted) {
      finishVoiceSpeaking(utteranceId);
+   } else {
+     // The grounded request failed before producing any text, so the service is
+     // still holding this turn in `thinking` behind its 30s response timer.
+     // Release it now instead of making the customer wait out the timeout.
+     interruptVoice();
    }
```

### Why `interruptVoice()` is the right primitive here

`interruptVoice` is the hook's `interrupt` (`src/hooks/use-voice-session.ts:135-148`). It sends:

```ts
      ws.send(JSON.stringify({ type: "interrupt", utteranceId: id }));
```

using `activeUtteranceRef.current`. For a **real** assistant-mode turn the ids agree, because the server
sent `transcript` with that id (`voice-session.ts:323`) and the client adopts it at
`use-voice-session.ts:350`:

```ts
          case "transcript":
            activeUtteranceRef.current = msg.utteranceId;
```

so the server's guard passes (`voice-session.ts:508`):

```ts
    if (clientUtteranceId !== this.utteranceId) return; // stale interrupt
```

`interrupt()` then calls `cancelWork()` — which clears `assistantResponseTimer`
(`voice-session.ts:526`) and closes any TTS — bumps `utteranceId`, and returns to `listening`
(`:517-522`). Exactly the desired outcome, using a path already exercised by barge-in.

It also sets the client to `listening` and clears `errorCode`, which is what you want: the customer sees
the widget become ready again immediately, and the *chat* error surfaces through the normal message-level
error rendering rather than as a fake voice timeout.

### Verify one thing before you commit to `interruptVoice()`

`interrupt()` invokes `onTurnCancelledRef.current?.(id, "barge_in")` (`:140`), which is wired to
`handleVoiceTurnCancelled` → `cancelVoiceAssistantRequest(utteranceId)`
(`storefront-assistant.tsx:1251-1253`). Since the request has *already* settled at this point, confirm
`cancelVoiceAssistantRequest` is idempotent for an already-finished request. If it is not, either make it
idempotent (preferred — it is a guard, not a behaviour change) or send the raw control message instead of
going through `interrupt()`. **Read it before choosing.**

## Alternative considered and rejected

Sending `startSpeaking(...)` immediately followed by `finishSpeaking(...)` would also close the turn, and
`finishAssistantSpeech` handles the zero-character case explicitly
(`voice-session.ts:459-465`). But it opens a TTS socket to immediately discard it — a wasted Sarvam
connection on every failure, which is the opposite of what T2 is trying to achieve.

## Blast radius

One `else` branch in the voice turn tail. Does not touch the success path, the delta path, or the reset
path. No protocol change; no voice-service change.

## Acceptance criteria

1. Force `/api/assistant/chat` to fail immediately (see below). The widget returns to `listening` within
   ~1s, not 30s.
2. The error the customer sees describes the chat failure, not `responseTimeout`.
3. The voice service logs the interrupt for that utterance and returns to `listening`; no
   `storefront response stream timed out` line appears.
4. The customer can immediately start another voice turn (this is also T1-6's criterion — verify both).
5. A **successful** turn is byte-for-byte unchanged in behaviour.
6. A turn that fails **mid-stream** (after ≥1 delta) still takes the `else if (speechStarted)` branch and
   flushes what was spoken — do not regress this.

## How to force the failure

Pick whichever is least invasive in your environment:
- Point `GEMINI_API_KEY` at an invalid value so generation fails before any delta.
- Temporarily `throw` at the top of `handleAssistantChat`.
- Block the `/api/assistant/chat` request in DevTools' network conditions.

The third is best — it exercises the real "customer on a flaky Indian mobile network" path, which is the
scenario this task exists for.

## Tests to add

`voice-agent/tests/voice-session.test.ts` already has *"a missing storefront response times out and
returns to listening"*. Add the sibling case:

> an interrupt for the pending grounded turn releases it immediately and clears the response timer

Assert the session reaches `listening` **without** advancing fake time to
`assistantResponseTimeoutMs`, and that no `assistant_timeout` error frame was emitted. The
`assistantResponseTimeoutMs` dependency injection point is `VoiceSessionDependencies`
(`voice-agent/src/session/voice-session.ts:19-24`) — the existing timeout test shows the pattern.

## Verification

```bash
npm run lint && npx tsc --noEmit && npm run test:unit
cd voice-agent && npm test && npm run typecheck
npx playwright test tests/e2e/assistant.spec.ts --project=chromium
```

## Rollback

Delete the `else` branch.
