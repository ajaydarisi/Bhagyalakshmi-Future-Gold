# T1-7 — Barge-in is ignored during server-initiated speech, and the canned line restarts

| | |
|---|---|
| **Severity** | medium |
| **Confidence** | `verified` |
| **Effort** | S (one line, plus a test) |
| **Category** | correctness |
| **Files** | `src/hooks/use-voice-session.ts:365-373`, `voice-agent/src/session/voice-session.ts:248-256` |
| **Sequencing** | none. Do with or after T1-8 (both concern the same canned re-prompt). |

## Symptom

The assistant says "క్షమించండి అండి, సరిగ్గా వినపడలేదు. మళ్ళీ చెప్పండి?" ("sorry, I didn't catch that,
please say it again"). The customer starts speaking over it. The audio stops for an instant — and then
**the same line starts again from the beginning**. Talking over it does not work.

## Verified root cause

The client and server utterance counters go out of sync for any **server-initiated** utterance.

**The client only ever adopts an id from a `transcript` or a `turn_cancelled` frame.** Every assignment to
`activeUtteranceRef` in `src/hooks/use-voice-session.ts`:

| Line | Assignment | Trigger |
|---|---|---|
| `:139` | `activeUtteranceRef.current = id + 1` | local `interrupt()` |
| `:180` | `activeUtteranceRef.current = 0` | `start()` |
| `:350` | `activeUtteranceRef.current = msg.utteranceId` | **`transcript`** |
| `:361` | `activeUtteranceRef.current = msg.utteranceId + 1` | **`turn_cancelled`** |

**`speakCanned` sends neither.** `voice-agent/src/session/voice-session.ts:248-256`:

```ts
  private speakCanned(text: string): void {
    if (this.destroyed || this.state !== "listening") return;
    const id = ++this.utteranceId;
    const tts = this.openTts(id, Date.now());
    this.setState("speaking");
    this.sendMsg({ type: "assistant_text", utteranceId: id, text });
    tts.sendText(text);
    tts.flush();
  }
```

It bumps the server counter and emits `assistant_text` + `audio` + `state` — but no `transcript`, because
the customer said nothing to transcribe. So the client's `activeUtteranceRef` is left behind at the
previous turn's id.

**The failure sequence:**

1. Server `utteranceId` becomes, say, `4`. Client `activeUtteranceRef` is still `3`.
2. Audio for `4` arrives. The `audio` case (`:381-395`) passes the staleness check
   (`if (msg.utteranceId < activeUtteranceRef.current) break;` — `4 < 3` is false), sees
   `4 !== playerUtteranceRef` and calls `player.beginUtterance(ctx)`. Playback starts. Note
   `playerUtteranceRef` becomes `4` but `activeUtteranceRef` is untouched.
3. Client VAD detects speech. `interrupt()` runs (`:135-148`) with `id = activeUtteranceRef.current = 3`:
   ```ts
       ws.send(JSON.stringify({ type: "interrupt", utteranceId: id }));
   ```
4. Server rejects it (`voice-session.ts:507-508`):
   ```ts
     private interrupt(clientUtteranceId: number, notifyClient = false): void {
       if (clientUtteranceId !== this.utteranceId) return; // stale interrupt
   ```
   `3 !== 4` → **discarded**. The server keeps synthesizing and streaming.
5. Locally, `interrupt()` did `player.stopAll()` and set `activeUtteranceRef = 3 + 1 = 4`. So the *next*
   `audio` frame for utterance `4` still passes the staleness check (`4 < 4` is false), and since
   `stopAll()` reset `playerUtteranceRef` to `-1`, the frame triggers a **fresh `beginUtterance`**.
6. The canned line restarts from wherever the server's stream has reached.

The general invariant is broken: **the client's `activeUtteranceRef` must track the server's `utteranceId`
for every utterance, not only for utterances that began with a transcript.** The same desync applies to
any future server-initiated speech.

## The change

Have the client adopt the id from `assistant_text`, which every server-initiated utterance already sends.
This needs **no protocol change**.

`src/hooks/use-voice-session.ts:365-373`, currently:

```ts
          case "assistant_text":
            if (msg.utteranceId >= activeUtteranceRef.current) {
              setAssistantText((previous) =>
                msg.utteranceId === activeUtteranceRef.current && previous
                  ? `${previous} ${msg.text}`
                  : msg.text,
              );
            }
            break;
```

becomes:

```ts
          case "assistant_text":
            if (msg.utteranceId >= activeUtteranceRef.current) {
              setAssistantText((previous) =>
                msg.utteranceId === activeUtteranceRef.current && previous
                  ? `${previous} ${msg.text}`
                  : msg.text,
              );
              // Server-initiated speech (watchdog re-prompts) never sends a
              // `transcript`, so this is the only frame that can keep the client's
              // counter aligned. Without it, interrupt() sends a stale id, the
              // server discards it, and the canned line restarts.
              activeUtteranceRef.current = msg.utteranceId;
            }
            break;
```

### Why the ordering inside the branch matters

The adoption must come **after** the `setAssistantText` updater is queued, because the updater's
append-vs-replace decision compares `msg.utteranceId === activeUtteranceRef.current`. React state updaters
run later, but they close over the value read at call time — so read carefully and confirm the append
behaviour for a **multi-sentence** reply is preserved: sentence 2 of utterance 7 must still *append* to
sentence 1, not replace it.

This is the one real regression risk in the task. Verify it explicitly (acceptance criterion 4).

### Why not fix it server-side

Two alternatives were considered and rejected:

- **Relax the server's staleness guard** (`voice-session.ts:508`) to accept any id ≤ current. That
  weakens the guard that makes barge-in safe against genuinely stale interrupts arriving after a new turn
  started. Do not.
- **Send a synthetic `transcript` with empty text for canned utterances.** `transcript` means "this is
  what the customer said". Faking it would corrupt the transcript UI (`setUserText` at `:352`) and any
  future analytics on transcripts. Do not.

## Blast radius

One statement inside one `case`. It affects every utterance, not just canned ones — which is the point —
so the multi-sentence append path and the barge-in path both need real verification. `assistant_text` is
also sent for normal assistant-mode speech (`voice-session.ts:445`), where `activeUtteranceRef` already
equals `msg.utteranceId` from the preceding `transcript`, making the assignment a harmless no-op there.

## Acceptance criteria

1. Trigger a watchdog re-prompt (stay silent after speaking, or mute the mic mid-turn) and talk over it →
   audio stops and **stays** stopped; the line does not restart.
2. The voice service logs `interrupt utterance N` for that utterance (proving the server accepted it), and
   returns to `listening`.
3. Normal barge-in over a grounded answer still works exactly as before.
4. A multi-sentence reply still renders as accumulated text on screen, not as only the last sentence.
5. `audio_reset` / `speak_reset` (the draft-revision path) still clears buffered audio correctly.
6. All 12 `voice-agent` tests pass.

## Tests to add

`voice-agent/tests/voice-session.test.ts` already has *"barge-in invalidates later speech chunks from the
cancelled response"*. Add:

> an interrupt during a server-initiated re-prompt is accepted, not discarded as stale

Drive it through the fake `stt` dependency: emit `END_SPEECH` with no transcript, advance fake time past
the watchdog's 5s + 3s so `speakCanned` runs, then deliver `{ type: "interrupt", utteranceId: <the id the
server used> }` and assert the session returns to `listening` and the TTS was closed.

Also add a client-side unit case if there is a suitable harness for `parseServerMsg`/reducer logic; if not,
the server test plus the manual check is sufficient — do not invent a React testing setup for this.

## Verification

```bash
npm run lint && npx tsc --noEmit && npm run test:unit
cd voice-agent && npm test && npm run typecheck && npm run build
npx playwright test tests/e2e/assistant.spec.ts --project=chromium
```

Easiest manual trigger for the canned path: start a session, say one word, then go completely silent. The
watchdog fires `END_SPEECH` → 5s flush → 3s later the re-prompt speaks. Talk over it.

## Rollback

Delete the added line. Behaviour returns to the restart bug.
