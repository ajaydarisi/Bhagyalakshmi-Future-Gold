# T2 — Abuse and cost control (5 grouped items)

| | |
|---|---|
| **Severity** | medium (verifier-corrected from the reviewer's "critical") |
| **Confidence** | `verified` — **this is the one dimension whose adversarial verification pass completed** |
| **Effort** | S each |
| **Files** | `voice-agent/src/gateway/voice.gateway.ts`, `voice-agent/src/session/voice-session.ts`, `voice-agent/src/common/env.ts` |
| **Sequencing** | independent of everything else. May land as one commit. |

**Deployment context that sets the severity:** `tasks/todo.md` records the voice service as a **single
Render instance** (`bfg-voice-agent`, `srv-d9nghanqj5pc73erlsqg`, region singapore) with
`MAX_CONCURRENT_SESSIONS` at its default of **8**. So the blast radius of an abusive client is "voice is
unavailable for the whole store", not "voice is slow" — but the exposure is one small business's Sarvam
quota, not a large attack surface. Fix it; do not gold-plate it.

---

## T2-1 — No per-client session cap: one script can hold all 8 slots

**File:** `voice-agent/src/gateway/voice.gateway.ts:73`

The only capacity control is global:

```ts
    if (this.sessions.size >= CONFIG.maxSessions) {
```

with `maxSessions` defaulting to 8 (`voice-agent/src/common/config.ts:19`). Nothing limits how many of
those 8 belong to one client.

The material needed to fix it **already exists and is unused**. The token carries a hashed-IP subject —
`src/app/api/voice/token/route.ts:73`:

```ts
    sub: crypto.createHash("sha256").update(ip).digest("base64url").slice(0, 22),
```

and `verifySessionToken` returns it (`voice-agent/src/auth/session-token.ts:48`):

```ts
        sub: typeof payload.sub === "string" ? payload.sub : undefined,
```

The verifier confirmed by grep that **no code in `voice-agent/src/` reads `claims.sub`**. It is minted,
transported, verified, and discarded.

**Change.** In `handleConnection`, after the token check and before the capacity check, count existing
sessions with the same `sub` and reject above a small cap:

```ts
    const MAX_SESSIONS_PER_CLIENT = 2;   // config-worthy only if it ever needs tuning
```

Store `claims.sub` in the existing `sessionMetadata` map (`:29-32`) — it already holds
`{ id, mode, startedAt }`, so add `sub`. Then count matches on connect. Reuse the existing rejection shape
(`:79-81`) so the client's `4429` → `busy` handling (`use-voice-session.ts:313-314`) works unchanged:

```ts
      ws.send(JSON.stringify({ type: "error", code: "busy", message: "assistant is busy" }));
      ws.close(4429, "busy");
```

Log the rejection with `reason: "client_session_limit"` so it is distinguishable from `at_capacity` on the
dashboard.

**Caveat to state in a comment:** `sub` is a hashed `x-forwarded-for` IP, so customers behind one carrier
NAT share a bucket. A cap of 2 is generous enough that this is acceptable; a cap of 1 would break shared
connections. Do not raise the cap to "fix" NAT — that gives the abuse case back.

**Acceptance:** open 3 sessions from one client → the third is rejected with `busy`. Two different clients
can each hold 2. A legitimate reconnect (the client's one bounded retry, `use-voice-session.ts:317-323`)
still succeeds — **verify this specifically**, because the old session may not have been reaped yet when the
retry arrives. If it collides, the cap must count only sessions whose socket is still `OPEN`, or the retry
path breaks.

---

## T2-2 — Inbound audio is unmetered per session

**File:** `voice-agent/src/session/voice-session.ts:119-121`

```ts
  onAudio(pcm: Buffer): void {
    this.stt.sendAudio(pcm); // every state — barge-in speech must reach STT
  }
```

Every frame is forwarded to Sarvam STT with no per-session ceiling other than wall-clock `sessionMaxMs`
(600s default). A client streaming continuously bills the full window of STT on every session, and with
T2-1's cap of 2 that is still 20 minutes of concurrent STT per client.

Per-frame size is already capped (`voice.gateway.ts:106`, `maxAudioFrameBytes` 16 KB) and backpressure
already drops frames (`sarvam-stt.client.ts:120-127`). Neither bounds the **total**.

**Change.** Accumulate bytes in `VoiceSession` and end the session past a generous ceiling:

```ts
  private uplinkBytes = 0;
```

In `onAudio`, add the byte count and compare against a new clamped config value —
`CONFIG.maxSessionUplinkBytes`, added to `voice-agent/src/common/config.ts` using the existing
`numberEnv(name, fallback, min, max)` helper (`:3-7`). Size the default from the real bitrate: 16 kHz ×
16-bit mono = **32 KB/s**, so 600s of continuous speech ≈ 19 MB. A ceiling of ~24 MB never touches a real
customer and hard-caps the abuse case.

On exceeding it, reuse the existing expiry path (`:548-551`) with a new code:

```ts
  private expire(code: string): void {
    this.sendMsg({ type: "error", code, message: "session ended" });
    this.ws.close(1000);
  }
```

**Client handling matters.** `use-voice-session.ts:399-407` only treats `session_idle` and `session_max` as
clean stops; anything else recoverable-or-fatal shows an error. Either name the new code `session_max`
(simplest — the customer-visible outcome is identical) or add the new code to that list. **Do not** invent a
code the client will render as a connection error.

**Comment it as a ponytail-style accepted ceiling**, since it is a blunt instrument:
`// ponytail: flat byte ceiling; per-minute rate limiting if abuse gets adaptive.`

---

## T2-3 — `mode=conversation` is publicly reachable, unused, and is a free LLM + TTS proxy

**File:** `voice-agent/src/gateway/voice.gateway.ts:52-56`

```ts
    const requestedMode = url.searchParams.get("mode");
    const mode: VoiceSessionMode =
      requestedMode === "assistant" || requestedMode === "transcribe"
        ? requestedMode
        : "conversation";
```

`conversation` is the **default** — anyone omitting `mode` gets it. In that mode the service runs its own
Gemini turn (`voice-session.ts:293-299`) and synthesizes the reply, with no grounding and no storefront
involvement. Production uses `assistant`; the client only sends `mode` when it is *not* `conversation`
(`use-voice-session.ts:280`):

```ts
      if (mode !== "conversation") socketUrl.searchParams.set("mode", mode);
```

So a valid token — obtainable by anyone who can load the site — buys an ungrounded Gemini + Sarvam TTS
conversation. The verifier rated this **low** because a token is still required and T2-1/T2-2 bound the
volume; but the mode is dead weight in production and should not be the default.

**Change.** Gate it behind an env flag, do not delete it — it is genuinely useful in development and it is
what `voice-agent/scripts/test-conversation.ts` exercises:

```ts
    const conversationAllowed = process.env.VOICE_ALLOW_CONVERSATION_MODE === "true";
```

Reject a `conversation` request when the flag is off (close `4400`, log
`reason: "mode_not_allowed"`), and consider flipping the fallback so an **omitted** `mode` resolves to
`assistant` in production. If you flip the default, re-check `voice-agent/scripts/*` and the tests, several
of which construct sessions without a mode.

Document `VOICE_ALLOW_CONVERSATION_MODE` in `voice-agent/.env.example` (T2-5) and in
`docs/voice-assistant-production.md`'s configuration table.

---

## T2-4 — `speak_reset` zeroes the per-turn TTS character budget, making it unbounded

**File:** `voice-agent/src/session/voice-session.ts:470-484`

```ts
  private resetAssistantSpeech(id: number): void {
    ...
    this.sendMsg({ type: "audio_reset", utteranceId: id });
    this.tts?.close();
    this.assistantSpeechChars = 0;
    this.spokenText = "";
    this.tts = this.openTts(id, Date.now(), this.assistantTtsLanguageCode);
```

The 4000-character per-turn cap enforced at `:432` is defeated by repeated resets:

```ts
    if (this.assistantSpeechChars + text.length > 4000) {
```

Each `speak_reset` returns the counter to zero, so a client alternating `speak_delta` and `speak_reset`
synthesizes unlimited audio in one turn — and each reset also **opens a fresh Sarvam TTS socket**, so the
socket count is unbounded too.

`speak_reset` is legitimate — it exists for the `answer_reset` draft-revision path
(`src/app/api/assistant/chat/route.ts:1433`, `:1457` → client `onReset` → `resetVoiceSpeaking`) and is
covered by the test *"a generation reset cancels the draft TTS stream and starts a clean one"*. So the cap
must survive resets without breaking that flow.

**Change.** Track a second counter that resets do **not** clear:

```ts
  private assistantTurnChars = 0;   // survives speak_reset; bounds the whole turn
```

Increment it alongside `assistantSpeechChars` in `appendAssistantSpeech` (`:443`), reset it only where a new
turn begins (`startAssistantSpeech`, `:402`, alongside the existing `assistantSpeechChars = 0`), and check
both in the `:432` guard. Give the turn ceiling headroom over the per-draft one — e.g. 12 000 — so a couple
of genuine revisions still fit. Reuse the existing `tts_text_limit` error rather than adding a code.

Optionally also cap **reset count** per turn (say 5) — cheaper to reason about than characters, and it
directly bounds the socket count, which is the actual cost.

---

## T2-5 — `voice-agent/.env.example` does not exist but is referenced twice

**Files:** `voice-agent/src/common/env.ts:4-11`, `docs/voice-assistant-production.md:56`

The first-run error message is a dead end:

```ts
export function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing ${name} — copy voice-agent/.env.example to voice-agent/.env and fill it in.`,
    );
  }
```

`voice-agent/.gitignore` ignores `.env` (correct) and there is no `.env.example`. A new contributor — or a
future Render redeploy — hits an instruction that cannot be followed.

**Change.** Create `voice-agent/.env.example` with every variable the service reads, **names and comments
only, no values**. Enumerate them from the source, do not guess:

```bash
cd voice-agent && rg -o 'process\.env\.[A-Z_]+' src/ | sort -u
```

Expect at least: `PORT`, `ALLOWED_ORIGINS`, `SARVAM_API_KEY`, `VOICE_TOKEN_SECRET`,
`VOICE_TOKEN_PREVIOUS_SECRET`, `GEMINI_API_KEY`, `LLM_PROVIDER`, `GEMINI_MODEL`, `SARVAM_LLM_MODEL`,
`SARVAM_TTS_SPEAKER`, `SARVAM_TTS_PACE`, `MAX_CONCURRENT_SESSIONS`, `SESSION_MAX_SECONDS`,
`SESSION_IDLE_SECONDS`, `ASSISTANT_UTTERANCE_SETTLE_MS`, `ASSISTANT_RESPONSE_TIMEOUT_SECONDS`,
`MAX_AUDIO_FRAME_BYTES`, `MAX_STT_BUFFERED_BYTES`, `MAX_SOCKET_BUFFERED_BYTES`, `WS_HEARTBEAT_SECONDS`,
`NODE_ENV` — plus `VOICE_ALLOW_CONVERSATION_MODE` (T2-3) and the uplink ceiling (T2-2).

Mark required vs optional and note the production validations in `common/env.ts:21-36` (secret ≥32 chars,
`ALLOWED_ORIGINS` mandatory). Include the secret-generation command already documented at
`docs/voice-assistant-production.md:61`:

```bash
openssl rand -base64 48
```

**Confirm `.env.example` is not swept up by `voice-agent/.gitignore`'s `.env` pattern** — check, and add a
negation if needed. A gitignored example file is the same bug again.

---

## Verification for the whole tier

```bash
cd voice-agent && npm test && npm run typecheck && npm run build && npm audit --omit=dev
```

Then, with the service running locally, exercise each limit:

```bash
cd voice-agent && npm run test:client    # existing harness; run several concurrently for T2-1
```

Confirm on the running service that health still reports capacity correctly — `/healthz` and `/readyz`
surface `getCapacity()` (`voice-agent/src/app.module.ts:8-21`), and T2-1 adds a second dimension that the
capacity payload does not express. Consider adding the per-client rejection count to the log stream rather
than to the health payload; health endpoints are polled by the platform and should stay cheap.

## Tests to add

`voice-agent/tests/` — all four code changes are unit-testable through existing seams:

- `protocol.test.ts` or a new gateway test: a third session from the same `sub` is rejected `4429`
- `voice-session.test.ts`: uplink byte ceiling ends the session with the expected error code
- `voice-session.test.ts`: repeated `speak_reset` eventually trips `tts_text_limit` (the per-turn counter),
  while a single legitimate reset still succeeds — **assert both**, or the fix will break the draft-revision
  flow
- gateway: `conversation` mode rejected when the flag is off, accepted when on

## Explicitly NOT in scope

The verifier examined and cleared these — see `99-REFUTED-do-not-fix.md` for the proofs:

- the instance-local `jti` replay map
- the token route's client-IP rate-limit key
- the hand-rolled HS256 signing
- CSP versus the VAD wasm assets

Also out of scope: **multi-instance correctness.** The `jti` map, the session registry and the token route's
rate-limit map are all instance-local, which is *correct today* on one Render instance. Record it as a
precondition on scaling — "before adding a second replica, these three maps need a shared store" — in
`docs/voice-assistant-production.md`. Do not build the shared store now.
