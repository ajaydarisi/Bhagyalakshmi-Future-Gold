# T1-6 — After a mid-answer failure, every recovery control is disabled for up to 28 seconds

| | |
|---|---|
| **Severity** | medium |
| **Confidence** | `verified` |
| **Effort** | S |
| **Category** | ux |
| **File** | `src/components/assistant/storefront-assistant.tsx` |
| **Sequencing** | Pairs with T1-5 — same failure, different symptom. Do them together and test once. |

## Symptom

The connection drops while the assistant is speaking. The panel shows "connection error". The customer
taps the mic to retry — nothing. Taps again — nothing. Types a message and presses send — the button is
greyed out. For up to 28 seconds the assistant is visibly broken with **no working control anywhere in the
UI**, and no explanation of why.

## Verified root cause

Three separate gates all key off the same `isSending` flag, and the flag stays true after the voice
session has already failed.

**Why `isSending` stays true.** The hook only cancels the in-flight grounded request when the *server*
state is `thinking`:

`src/hooks/use-voice-session.ts:95-103` (`stop`):
```ts
    if (serverStateRef.current === "thinking") {
      onTurnCancelledRef.current?.(id, "stopped");
    }
```
`:105-116` (`fail`) and `:306-309` (`onclose`) have the same `=== "thinking"` condition.

Once the client has sent `speak_start`, the server state is `speaking`, **not** `thinking`. So a
`fail("disconnected")` while the assistant is talking never fires `onTurnCancelled`, never calls
`cancelVoiceAssistantRequest`, and leaves the `/api/assistant/chat` stream running with `isSending` true.
That stream re-arms its own 28s timeout on **every** delta (`storefront-assistant.tsx:820-827`, re-armed at
`:864` and `:883`), so `ASSISTANT_CLIENT_TIMEOUT_MS = 28_000` (`:123`) is the ceiling on the lockout.

**The three gates, all verified:**

1. `handleVoiceToggle`, `:1206-1208`:
   ```ts
       if (isSendingRef.current) {
         return;
       }
   ```
2. Both mic buttons — the launcher at `:1337` and the in-panel one at `:1724`:
   ```ts
              disabled={!hydrated || (isSending && !voiceActive)}
   ```
   ```ts
                        disabled={isSending && !voiceActive}
   ```
   In the error state `voiceActive` is **false**, so `isSending && !voiceActive` is true → disabled.
3. The send button, `:1743`:
   ```ts
                      disabled={isSending || !input.trim()}
   ```
   and a typed retry would be dropped anyway by the guard at `:778-779`.

**And there is no alternative affordance.** The mute/interrupt row only renders for the three live states,
`:1665-1667`:

```ts
                    {(voiceState === "listening" ||
                      voiceState === "thinking" ||
                      voiceState === "speaking") && (
```

So in `error` / `mic_denied` there is no mute, no interrupt, and no retry control. This directly
contradicts the failure matrix the build plan promises at
`docs/voice-assistant-build-plan.md:449` ("error state + working retry").

## Why the lockout exists (do not just delete it)

The guard is there so a **typed** request in flight is not clobbered by a second submission. That is a real
concern and must be preserved. The bug is that the guard is keyed on the bare flag rather than on *which
kind* of request is in flight.

## The change

Key the gates on the in-flight request's **source** instead of on `isSending` alone.

`storefront-assistant.tsx` already tracks the active request — `activeAssistantRequestRef` — and
`sendMessage` takes a `source: "text" | "voice"` parameter (`:757-759`). Read `activeAssistantRequestRef`'s
declaration and confirm it carries `source`; if it does not, add it there (one field on an existing ref) —
that is still the smallest change, because it makes all three gates correct at once.

Then:

**1. `handleVoiceToggle`, `:1206`:**
```ts
-   if (isSendingRef.current) {
+   // Only a typed request may block starting voice. A stale *voice* request is
+   // exactly what the customer is trying to escape from, and startVoice() tears
+   // the previous session down anyway.
+   if (activeAssistantRequestRef.current?.source === "text") {
      return;
    }
```

**2. Both mic buttons (`:1337`, `:1724`):**
```ts
-   disabled={!hydrated || (isSending && !voiceActive)}
+   disabled={!hydrated || (isSendingText && !voiceActive)}
```
```ts
-   disabled={isSending && !voiceActive}
+   disabled={isSendingText && !voiceActive}
```

Derive one value near the other render-time computations:
```ts
  const isSendingText =
    isSending && activeAssistantRequestRef.current?.source === "text";
```

> **Caveat to handle:** a ref read during render does not trigger a re-render when it changes. If
> `activeAssistantRequestRef` is the only place `source` lives, the button's `disabled` will not update
> reactively. Check whether an existing piece of state already distinguishes them; if not, the correct
> minimal fix is to store the source in **state** alongside `isSending` (or replace `isSending: boolean`
> with `sending: null | "text" | "voice"`), which is one state variable instead of two and makes all three
> gates trivially reactive. **Prefer that** if `isSending` is a `useState` — grep its declaration first.

**3. Send button (`:1743`) — leave it as `isSending`.** A typed retry during an in-flight *voice* request
is genuinely ambiguous, and `sendMessage`'s own guard at `:779` already cancels an in-flight voice request
when a new one arrives. Verify that path works and change nothing here. If it does not cancel cleanly,
that is a separate finding — record it, do not fix it inside this task.

**4. Give the error state a way out.** Extend the control row's render gate at `:1665` so the error states
render a single **Retry** button (not mute/interrupt):

```ts
{(voiceState === "error" || voiceState === "mic_denied") && (
  <Button type="button" variant="outline" size="sm" onClick={handleVoiceToggle}>
    {voiceT("retry")}
  </Button>
)}
```

`handleVoiceToggle` already calls `startVoice()`, which tears down the previous session first
(`use-voice-session.ts:174-188` bumps `generation` and calls `releaseResources()`), so it is safe to press
repeatedly.

**Add the `retry` key to BOTH `messages/en/voice.json` and `messages/te/voice.json`** — a missing `te` key
breaks the Telugu locale (CLAUDE.md). Check whether a suitable key already exists before adding one; the
namespace already carries `start`, `stop`, `mute`, `unmute`, `interrupt`, `micDenied`, `busy`,
`audioError`, `noSpeech`, `responseTimeout`, `audioUnavailable`, `notSupported`, `connectionError`.

## Consider also fixing the root cause

The deeper issue is the `=== "thinking"` condition in three places
(`use-voice-session.ts:97`, `:108`, `:306`). Widening it to `!== "listening"` would make a
`fail`/`stop`/`onclose` during `speaking` also cancel the grounded request — which would fix `isSending`
at the source and make T1-6's gate changes belt-and-braces rather than the whole fix.

**Do this only if you verify it does not break barge-in.** During normal barge-in the client calls
`interrupt()`, which is a *different* path and already notifies. Widening these three conditions affects
teardown paths only. It is the more principled fix; it is also the one with the real regression risk.
Decide explicitly and say which you chose in the PR description.

## Blast radius

Client-only. No protocol, no voice service, no server route. The risk is UI reactivity (see the caveat) —
so the acceptance test must be clicked through by hand, not just type-checked.

## Acceptance criteria

1. Kill the WebSocket while the assistant is speaking → panel shows an error **and** a working Retry.
2. Tapping the mic in the error state starts a new session immediately (no 28s wait).
3. Typing and sending in the error state works.
4. A genuine typed request in flight still blocks a second typed submission and still blocks starting
   voice (the original protection is intact).
5. Barge-in during normal speech is unchanged.
6. Both locales render the new control with translated copy.

## How to reproduce the failure

With both services running, start a voice turn and, while the assistant is speaking, either:
- stop the voice service (`Ctrl-C` in its terminal), or
- in DevTools set the network to offline for ~2s and back.

Before the fix: every control dead for up to 28s. After: Retry works immediately.

## Verification

```bash
npm run lint && npx tsc --noEmit && npm run test:unit
npx playwright test tests/e2e/assistant.spec.ts --project=chromium
npm run build
```

Add an e2e case to `tests/e2e/assistant.spec.ts` if the harness can drop the socket mid-utterance; if it
cannot, record the manual steps in the PR description instead of skipping the check.

## Rollback

Revert the gates and remove the Retry button. Leave the `messages/*/voice.json` keys — unused keys are
harmless and re-adding them is churn.
