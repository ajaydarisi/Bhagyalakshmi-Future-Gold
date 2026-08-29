# T1-9 — The query-embedding retry can burn 24s of a 30s voice turn before retrieval even starts

| | |
|---|---|
| **Severity** | medium |
| **Confidence** | `verified` |
| **Effort** | S |
| **Category** | latency |
| **File** | `src/lib/ai/gemini.ts:60-86` |
| **Sequencing** | Land before or with T1-3 if T1-3's latency measurement comes out marginal — both spend from the same voice budget. |

## Symptom

When Gemini's embedding endpoint is slow or flaky, a voice turn dies of timeout without the customer ever
hearing anything, and the error they get is `responseTimeout` — which blames the wrong component. On a good
day the feature is fine; on a bad Gemini day voice is unusable while typed chat merely feels slow.

## Verified root cause

`src/lib/ai/gemini.ts:60-86`:

```ts
  const embed = async () => {
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: {
        taskType: options.taskType,
        title: options.title,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
    });

    const embedding = response.embeddings?.[0]?.values;
    if (!embedding || embedding.length === 0) {
      throw new Error("Gemini did not return an embedding");
    }

    return embedding;
  };

  try {
    return await embed();
  } catch {
    // One retry: a failed query embedding silently degrades retrieval to
    // keyword-only, which produces far worse grounding than a 1s delay.
    return await embed();
  }
}
```

Two facts to hold together:

1. **The call is bounded.** The client sets `httpOptions: { timeout: getHttpTimeout() }` (`:29`), and
   `getHttpTimeout()` reads `AI_HTTP_TIMEOUT_MS` clamped 5–30s with a **12s default** (`:9`, `:15-18`).
   So the finding is *not* "unbounded hang" — that part of the original report was wrong.
2. **But it is bounded at 2 × 12s = 24 seconds**, and the comment's premise ("a 1s delay") is what makes
   the retry look cheap. It is only cheap when the first attempt fails *fast*. A **timeout** failure is the
   expensive case, and it is also the most likely one under degradation.

Against the voice budget:

| Budget | Value | Source |
|---|---|---|
| Server-side grounded response timer | **30 000 ms** | `voice-agent/src/common/config.ts:25-26` |
| Client-side request timeout | **28 000 ms** | `src/components/assistant/storefront-assistant.tsx:123` |
| Worst-case embedding alone | **24 000 ms** | `gemini.ts:29` × 2 attempts |

24 of 30 seconds spent before retrieval, generation or the first spoken sentence. The turn cannot succeed.

**And no `AbortSignal` reaches the call.** `embedContent`'s `config` carries only `taskType`, `title` and
`outputDimensionality`. The route threads a `signal` through generation
(`refineAssistantVoicePrompt(latestUserMessage, signal)` at `route.ts:977`,
`generateAssistantGroundedReply({ ..., signal })`), but the embedding step is not cancellable. So when the
customer **barges in** and the client aborts, a 24-second embedding keeps running and keeps billing.

The retry's justification is genuinely correct **for typed chat**, where a 24s worst case is a slow page,
not a failed interaction. It is wrong for voice.

## The change

Two independent fixes. Do both — they address different failure modes.

### 1. Make the embedding cancellable (applies to all callers)

Thread the caller's `AbortSignal` into the request. Check `@google/genai`'s current surface for where the
signal belongs (`config.abortSignal` or `httpOptions`) — read the installed typings rather than guessing:

```bash
rg -n "abortSignal|AbortSignal" node_modules/@google/genai/dist/*.d.ts | head
```

Then add `signal?: AbortSignal` to the `options` parameter of the embed function and pass it through. Find
every caller and thread the signal from the ones that already have one:

```bash
rg -n "embedQuery|embedContent" src/
```

`src/lib/retrieval/catalog.ts` is the main consumer (hybrid search) — it should already have a signal in
scope on the chat path.

**Why this matters independently of the retry:** barge-in becomes cheap. Today every abandoned turn leaves
an embedding running to completion.

### 2. Skip the retry on a voice turn

Add an option and let the caller decide, rather than reading env or globals inside the helper:

```ts
   try {
     return await embed();
   } catch {
-    // One retry: a failed query embedding silently degrades retrieval to
-    // keyword-only, which produces far worse grounding than a 1s delay.
+    // One retry: a failed query embedding degrades retrieval to keyword-only,
+    // which grounds far worse than a short delay. But the failure mode that
+    // matters is a TIMEOUT, and 2 x AI_HTTP_TIMEOUT_MS (24s default) does not
+    // fit inside a voice turn's 30s budget — so voice degrades instead of retrying.
+    if (options.singleAttempt) throw error;
     return await embed();
   }
```

(Capture the error in the `catch` binding so it can be rethrown: `catch (error) {`.)

Pass `singleAttempt: true` from the voice path. Use the `isVoiceTurn` constant from **T1-2**; if T1-2 has
not landed, use `payload.source === "voice"` and let T1-2 hoist it. The flag has to travel from
`route.ts` → `retrieval/catalog.ts` → `embedQuery`, so check how many hops that is before writing it; if
the plumbing is more than two parameters deep, prefer passing it as part of the existing retrieval options
object rather than adding a positional argument at each level.

**Degrading to keyword-only is the correct behaviour for voice.** The catalog search is *hybrid*
(vector + FTS, `hybrid_search_products`, migration 007) — with no embedding it still returns FTS results.
A slightly worse-grounded spoken answer in 4 seconds beats a perfect answer the customer never hears.

### 3. Consider tightening the voice-path timeout too

Even one 12s attempt is a large slice of a 30s budget that must also fit refinement (T1-3), retrieval and
generation. A tighter per-attempt deadline for voice — e.g. 6s — would fail fast to keyword-only.

Do **not** do this by lowering `AI_HTTP_TIMEOUT_MS`: it is shared with generation, where 12s is
appropriate. If you want it, pass a per-call timeout for the voice embedding specifically. **Measure
first** — instrument the embedding duration (T3 gives you the structured-logging pattern) and only add the
tighter deadline if the p95 justifies it. Do not add a second tuning knob on speculation.

## Blast radius

- `embedQuery` is also used for **indexing** (`src/lib/retrieval/catalog.ts` sync path, called from
  `src/app/admin/actions.ts`). Indexing **must keep the retry** — it is a background write where
  correctness beats latency, and it has no 30s budget. Default `singleAttempt` to `false` so indexing is
  untouched by omission.
- Adding a signal is additive and safe.
- Typed chat keeps both attempts and is unaffected.

## Acceptance criteria

1. With the embedding endpoint made to fail (invalid key or a network block), a **voice** turn produces a
   spoken answer grounded by FTS-only results within the normal latency envelope — it does not time out.
2. The same failure on a **typed** turn still retries once (unchanged behaviour).
3. Barge-in during retrieval cancels the embedding request — visible as an aborted request in the network
   panel, not one that runs to completion.
4. Retrieval-index sync from the admin panel still retries and still produces correct embeddings.
5. Vector search quality on a healthy path is unchanged (spot-check three queries against `main`).

## How to force the failure

- Temporarily set an invalid `GEMINI_API_KEY` — but note this also breaks generation, so it tests the
  timeout path rather than the degrade-to-FTS path.
- Better: block `generativelanguage.googleapis.com/*:embedContent` in DevTools while leaving
  `:streamGenerateContent` alive. That isolates exactly this failure and proves criterion (1).

## Tests to add

`tests/unit/` — a small unit test around the embed helper with an injected failing client:

- fails twice, `singleAttempt: false` → two attempts, then throws
- fails once, `singleAttempt: false` → second attempt's value returned
- fails once, `singleAttempt: true` → throws immediately, **one** attempt only

Assert the attempt **count**; that is what encodes the fix. If the module's client construction makes
injection awkward, the smallest acceptable alternative is to extract `embed` so the retry policy is
testable in isolation — but only if it costs a few lines. Do not restructure the module for testability.

## Verification

```bash
npm run lint && npx tsc --noEmit && npm run test:unit && npm run build
```

Then the live degradation check above, in both locales.

## Rollback

Remove `singleAttempt` from the voice call site — the retry returns. Keep the `AbortSignal` threading; it
is an unconditional improvement.
