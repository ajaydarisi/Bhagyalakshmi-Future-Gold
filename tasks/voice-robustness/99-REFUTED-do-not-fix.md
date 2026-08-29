# Refuted findings — do NOT "fix" these

Each item below was reported by a reviewer as a defect, investigated against the source, and **proven not to
be one**. They are recorded with their proofs so the same rework is not done twice, and so a future reviewer
who spots the same shape can stop early.

If you believe one of these refutations is wrong, say precisely why **with a file:line citation** before
touching the code. Do not re-open one on a hunch.

---

## R1 — "Navigation resolvers never see the refined transcript" — *partly wrong, and the true version is T1-3*

**Reported:** `latestUserMessage` is never updated with the refined voice transcript.

**Refuted:** it is. `src/app/api/assistant/chat/route.ts:872` declares it as `let`, and `:979` genuinely
reassigns it:

```ts
        latestUserMessage = refined;
```

It also patches the message array so retrieval and generation see the refined text (`:980-985`).

**But** the *ordering* is wrong — refinement happens at `:976`, after all three navigation resolvers. That is
a real, verified defect, and it is written up properly as **T1-3**. Implement T1-3; ignore the original
framing.

---

## R2 — "`page=` is in the products param schema but the products page never reads it"

**Refuted.** `src/app/[locale]/(store)/products/page.tsx` declares `page?: string` in its `searchParams`
type (`:35`) and threads it all the way through: the fetch helper takes `page: number` (`:165`), passes it
into the cache key (`:180`), and uses it for the range offset (`:254`):

```ts
      const from = (page - 1) * PRODUCTS_PER_PAGE;
```

The schema entry at `assistant-route-manifest.ts:122` is correct and load-bearing. **Do not remove it.**

---

## R3 — "The discarded answer is already spoken, and the broadened retry concatenates onto it"

**Reported:** `generateAssistantGroundedReply` streams answer deltas before citations are validated, so when
the broadened retry at `route.ts:1208` produces a different answer, the second answer is appended to the
first — the customer hears two stitched-together replies.

**Refuted.** The prefix-divergence case is handled end-to-end, and it was designed on purpose.

`src/app/api/assistant/chat/route.ts:1452-1457`:

```ts
          const finalAnswer = payload.reply.answer;
          if (!finalAnswer.startsWith(streamedAnswer)) {
            streamedAnswer = "";
            send({ type: "answer_reset" });
          }
```

`answer_reset` is a first-class stream event (`src/lib/assistant-stream.ts:28`, dispatched at `:116`). The
client's `onReset` handler (`storefront-assistant.tsx:1236-1239`) calls `speech.reset()` and
`resetVoiceSpeaking(utteranceId)`, which sends `speak_reset`. The service's `resetAssistantSpeech`
(`voice-agent/src/session/voice-session.ts:470-484`) closes the draft TTS socket, emits `audio_reset`, and
opens a clean one. The client's `audio_reset` case (`use-voice-session.ts:374-380`) calls `player.stopAll()`
and clears the displayed text.

There is a pinned regression test: *"a generation reset cancels the draft TTS stream and starts a clean one"*
(`voice-agent/tests/voice-session.test.ts`).

**The one true residue is not a defect:** audio that has already *played* cannot be un-played — `audio_reset`
clears buffered audio, not sound already in the customer's ear. That is an inherent property of
speak-as-you-generate and is documented as intended at `docs/voice-assistant-production.md:33`. Accept it.

**Related, and worth knowing:** T2-4 shows the *reset budget* is exploitable, and that IS a real finding —
but it is about the character cap, not about concatenation.

---

## R4 — "The token route's client-IP key is weaker than the chat route's and collapses to one bucket"

**Refuted by the completed adversarial pass** (this was the one dimension whose verifier finished).

`src/app/api/voice/token/route.ts:47`:

```ts
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
```

The verifier's conclusion: this is adequate for its purpose. The instance-local limiter is explicitly
documented as a partial measure — `docs/voice-assistant-production.md:97-104` requires edge rate limiting
*because* serverless instances do not share memory, and the `ponytail:` comment at `:16-17` names exactly
that ceiling:

```ts
// ponytail: instance-local rate limit (10/min/IP); move to a shared store if
// the voice feature ever outgrows one serverless instance's traffic.
```

Downgraded to `low` and out of scope. The real capacity control is the per-client **session** cap
(**T2-1**), which is enforced at the gateway where it actually binds.

---

## R5 — "The instance-local `jti` replay map is inadequate"

**Refuted.** `voice-agent/src/gateway/voice.gateway.ts:152-160` implements single-use token enforcement,
which **exceeds** the plan — `docs/voice-assistant-build-plan.md:227` deliberately omitted replay
protection. And it carries no security load: anyone who can load the site can mint a fresh token from
`/api/voice/token`, so replaying an old one buys nothing.

**Leave it exactly as is.** It is a free extra guard on a single instance. Note in
`docs/voice-assistant-production.md` that it (like the session registry and the token rate limiter) needs a
shared store *before* a second replica exists — that is a scaling precondition, not work to do now.

---

## R6 — "CSP conflicts with the VAD wasm assets"

**Refuted on both halves.**

1. There is **no CSP** configured — `next.config.ts:30-49` sets no `Content-Security-Policy` header. Nothing
   can conflict with a policy that does not exist.
2. The assets are **already self-hosted**, not loaded from a CDN. `src/lib/voice/barge-in.ts:26-27`:

   ```ts
       baseAssetPath: "/vad/",
       onnxWASMBasePath: "/vad/",
   ```

   and `docs/voice-assistant-production.md:76` confirms `postinstall` copies the VAD runtime into
   `public/vad/`.

**One cleanup is warranted:** the `ponytail:` comment above that call is now **stale** —

```ts
  // ponytail: model/wasm assets come from the package's default CDN; self-host
  // under public/vad/ (baseAssetPath/onnxWASMBasePath) if CSP or offline matters.
```

The self-hosting it recommends has already been done. Delete those two comment lines (and only those) —
per `02-CONVENTIONS-and-verification.md`, a `ponytail:` comment must describe a shortcut that still exists.
Attach the deletion to whichever task you touch that file in, or land it standalone.

Adding a CSP is a separate, worthwhile hardening task for the whole storefront. Out of scope here — and note
it would need to permit `wasm-unsafe-eval` for the VAD.

---

## R7 — "The hand-rolled HS256 token signing is risky; use a JWT library"

**Refuted by the completed adversarial pass.** The verifier round-tripped a real token minted by
`src/app/api/voice/token/route.ts:66-75` through the voice service's own `jsonwebtoken` dependency: `iss`,
`aud`, `exp`, `iat`, `jti` and `sub` all verify, and an `alg:none` forgery is rejected by the algorithm
allowlist at `voice-agent/src/auth/session-token.ts:33`:

```ts
        algorithms: ["HS256"],
```

Skipping a JWT dependency on the storefront side for one fixed payload was the correct call. **Do not churn
it.** The `sub` claim being unread by the gateway is a separate, real gap — that is **T2-1**.

---

## R8 — "One unrecognized server frame hard-kills the session, so either deploy order breaks voice"

**Not refuted, but deliberately not scheduled — and the reasoning matters.**

The mechanism is real. `src/hooks/use-voice-session.ts:338-342`:

```ts
        const msg = parseServerMsg(parsed);
        if (!msg) {
          fail("protocol_error", generation);
          return;
        }
```

Any frame `parseServerMsg` (`src/lib/voice/protocol.ts:28-104`) does not recognize kills the session. Since
the two `protocol.ts` files are hand-mirrored copies — stated in the header of
`src/lib/voice/protocol.ts:1-2` — a deploy that adds a server message type before the client understands it
takes voice down until the client catches up. `voice-agent/src/common/protocol.ts` is equally strict in the
other direction (`voice.gateway.ts:113-122` closes `4400` on an unparseable control message).

**Why it is not in the plan:** fixing it properly means deciding a forward-compatibility policy (ignore
unknown frames? version the protocol? tolerate unknown fields but not unknown types?), and that is a design
decision for the owner, not a mechanical fix. The mitigation available today is **operational and already
documented** — `docs/voice-assistant-production.md:85-90` specifies the deploy order (voice service first,
then storefront), and `:162` says to roll the container back independently when the protocol is unchanged.

**If you want the cheap 80%:** make the *client* ignore unknown `type` values instead of failing, while
keeping strict validation for known types. That is forward-compatible in the direction that actually breaks
(server ships first, per the documented order) and is a few lines in the `parseServerMsg` caller. Raise it
as its own task with the owner; do not fold it into another commit.

---

## Also investigated and found correct (no action)

- **`reconnectedRef` is never reset after a successful reconnect** (`use-voice-session.ts:317`). True, so the
  budget is one reconnect *per session*, not one per drop. Reported as `low`; this is a defensible policy
  choice, not a bug — an endlessly reconnecting session on a bad network is worse than a clear error the
  customer can retry, and T1-6 gives them a working Retry button. Leave it; revisit only if disconnect
  telemetry from T3-2 shows repeat drops are common.
- **`assistantSettleMs` of 1400ms feels long.** It is deliberate and is the mechanism that stops a natural
  pause from sending half a sentence (`docs/voice-assistant-production.md:17`), with two tests pinning it.
  Tune only with real recordings, never on intuition.
- **The two sentence splitters differ** (`voice-agent/src/common/sentence-chunker.ts` vs
  `src/lib/voice/sentence-stream.ts`). Intentional: the client one adds soft-chunking at 80/180 chars for
  streaming, the server one is a plain terminator split. Both handle the Telugu danda `।`. Not a defect.
- **`voice-agent/src/llm/system-prompt.ts` is Telugu-only** even though the store is bilingual. Correct for
  `conversation` mode, which is a Telugu-only feature (and which T2-3 gates off in production anyway). The
  bilingual path is `assistant` mode, whose prompt is `src/lib/retrieval/answer.ts` — that is T1-2.
