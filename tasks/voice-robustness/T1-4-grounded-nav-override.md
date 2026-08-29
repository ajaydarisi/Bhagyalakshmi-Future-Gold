# T1-4 — Grounded navigation overrides the LLM's explicit "this is not a navigation request"

| | |
|---|---|
| **Severity** | high |
| **Confidence** | `verified` |
| **Effort** | S |
| **Category** | correctness |
| **File** | `src/app/api/assistant/chat/route.ts:1043-1070` |
| **Sequencing** | **After T1-3** — same code block, and T1-3 changes one of this block's inputs. |

> ## ⚠️ WITHDRAWN 2026-08-06 — this was a FALSE POSITIVE. Do not implement.
>
> Discovered during implementation. Two independent proofs:
>
> **1. The motivating example never reaches the code.** The grounded block is gated on
> `shouldTryLlmNavigation = isAssistantLlmNavigationRequest(latestUserMessage)`, whose regex requires an
> explicit navigation verb (`assistant-llm-navigation.ts:96-105`). Evaluated directly:
>
> | Utterance | `isAssistantLlmNavigationRequest` |
> |---|---|
> | `Do you have gold bangles?` | **false** |
> | `what is your return policy` | **false** |
> | `how much are gold bangles` | **false** |
> | `Take me to the returns section` | true |
> | `show me gold bangles` | true |
>
> Plain questions are already excluded, so the "asks a question, gets navigated" failure cannot happen.
> Every request that *does* reach the block contains "take me to" / "show me", where navigating is the
> correct response.
>
> **2. The behaviour is deliberate and pinned by a test.**
> `tests/unit/assistant-chat-navigation-fallback.test.ts:106` is named *"falls through a safe LLM miss to
> retrieval-grounded policy navigation"* and asserts exactly that `reason: "model_miss"` on
> `"Take me to the returns section"` yields `navigationResolution: "grounded"`. Implementing the gate broke
> that test plus the fallback-deadline test at `:133`. `model_miss` means the model could not pick a route
> for a request that IS navigation-shaped — the deterministic matcher is the right fallback there, not a
> thing to suppress.
>
> `not_navigation` is the only true refusal, and it is produced by a pre-check the route has already
> passed, so it is unreachable from this call site. The gate would have been a no-op at best.
>
> **What was kept:** the observability half. The answer-path log line at
> `src/app/api/assistant/chat/route.ts` now carries `source` (voice vs typed) and
> `llmNavigationMissReason`, which is genuinely useful and was the only durable part of this task.
>
> **Root cause of the false positive:** this finding's adversarial verifier was one of the five killed by
> a session limit. An unverified finding reached the plan labelled `verified` on the strength of the
> mechanism being real; the mechanism *was* real, but unreachable. The original analysis follows for the
> record.

---

## Symptom

The customer asks a question and the page jumps instead of answering. "Do you have gold bangles?" is a
question; the assistant navigates to a bangles listing rather than saying yes and describing them. For a
voice session this is worse than for typed chat, because the widget closes on navigation
(`storefront-assistant.tsx:693`) and the customer loses the thread of the conversation.

## Verified root cause

Two navigation deciders run in sequence and the second ignores the first's verdict.

**Step 1 — the LLM decides.** Around `:940-971`, when `isAssistantLlmNavigationRequest(query)` is true,
`resolveAssistantLlmNavigation` runs. If it resolves, the route returns a navigation reply immediately. If
it does not, the reason is captured (`:971`):

```ts
      llmNavigationMissReason = llmNavigation.reason;
```

`AssistantLlmNavigationMissReason` is a discriminated set declared at
`src/lib/assistant-llm-navigation.ts:27` — read it and enumerate the members before writing code. It
distinguishes an *explicit negative* ("the model considered this and said it is not navigation") from
*mechanical failures* (timeout, unparseable response, no matching route).

**Step 2 — a heuristic overrides it.** `:1043-1049`:

```ts
    if (shouldTryLlmNavigation) {
      const groundedNavigation = resolveAssistantGroundedNavigation({
        query: languageSourceMessage,
        locale: responseLocale,
        retrievedContext: firstItems,
        pageContext,
      });

      if (groundedNavigation?.type === "navigation") {
        const reply = buildAssistantNavigationReply({ ... });
```

The gate is `shouldTryLlmNavigation` — **the same flag that enabled step 1** — not "step 1 was
inconclusive". `llmNavigationMissReason` is carried all the way into the log line at `:1063`:

```ts
          llmNavigationMissReason,
```

…and then never consulted for a decision. The block ends in a hard
`return NextResponse.json({ reply, handoff: null })` (`:1069`), so the answer path is never reached.

So: the LLM is asked, says "not navigation", and a keyword-and-retrieval heuristic overrules it and
navigates anyway.

**Mitigating factor (why this is high and not critical):** the grounded matcher is not reckless. It
requires the candidate to actually be named in the request — `isCandidateRelevantToRequest` at
`src/lib/assistant-navigation-grounding.ts:247-260` — and it returns *options* rather than a guess when
several candidates are plausible (`:459-465`). So baseline retrieval noise cannot cause a random page
jump. The failure is narrower: the request mentions a real catalog thing *and* is phrased as a question,
so the heuristic sees a relevant candidate and the LLM's "this is a question, not a command" is discarded.
That is a common phrasing, not an edge case.

## Why the naive fix is wrong

Do **not** simply change the gate to `if (shouldTryLlmNavigation && !llmNavigationMissReason)`. The
grounded matcher is a legitimate and valuable fallback when step 1 failed *mechanically* — a timeout, a
malformed model response, or a model answer that named no known route. Suppressing it in those cases would
make navigation worse on exactly the flaky paths where a deterministic fallback matters most.

The distinction is between "the model gave a considered no" and "the model did not manage to answer".

## The change

### Step 1 — classify the miss reasons

Open `src/lib/assistant-llm-navigation.ts:27` and read `AssistantLlmNavigationMissReason`'s members.
Partition them into two groups:

- **Explicit negative** — the model evaluated the request and concluded it is not a navigation request.
  Grounded navigation must be **skipped**.
- **Mechanical** — timeout, abort, parse failure, no matching route, schema violation. Grounded navigation
  **should still run**.

Encode the partition next to the type, in `assistant-llm-navigation.ts`, so it lives with the type it
describes rather than in the route:

```ts
/** Reasons that represent a considered "not navigation" verdict from the model.
 *  Mechanical misses (timeout, parse failure, no route matched) are NOT here —
 *  the grounded fallback is still correct in those cases. */
export function isAssistantLlmNavigationRefusal(
  reason: AssistantLlmNavigationMissReason | undefined,
): boolean {
  return reason === /* the explicit-negative member(s) */;
}
```

Use the real member names from the type — do not invent them.

### Step 2 — gate the grounded attempt

`src/app/api/assistant/chat/route.ts:1043`:

```ts
-   if (shouldTryLlmNavigation) {
+   // A considered "not navigation" from the model is a decision, not a gap: the
+   // grounded matcher is a fallback for mechanical misses only, or it will turn
+   // questions that merely mention a product into page jumps.
+   if (shouldTryLlmNavigation && !isAssistantLlmNavigationRefusal(llmNavigationMissReason)) {
```

Import the helper alongside the existing `assistant-llm-navigation` imports.

### Step 3 — keep the observability

The log line at `:1052-1066` fires only inside the navigation branch. When the branch is now skipped, the
skip must still be visible or you have traded a bug for a blind spot. Ensure the miss reason and the fact
that grounded navigation was suppressed appear in whichever log line the answer path emits — the route
already has an `[assistant.chat]` line on the answer path; add `llmNavigationMissReason` and a
`groundedNavigationSkipped: true` field to it.

This also gives you the metric that tells you whether the partition is right: if
`groundedNavigationSkipped` correlates with customers immediately re-asking "take me there", the
partition is too aggressive.

## Blast radius

- Only the voice/typed navigation decision path. Retrieval, answer generation and the manifest invariant
  are untouched.
- `shouldTryLlmNavigation`'s own definition does not change — find it above `:940` and leave it alone.
- The `options` branch at `:1071` (`groundedNavigation?.type === "options"`) sits inside the same `if`, so
  it is suppressed by the same gate. That is correct: if the model said "not navigation", offering a
  choice of pages to navigate to is the same mistake with extra steps.

## Acceptance criteria

1. "Do you have gold bangles?" → a spoken/typed **answer**, no navigation.
2. "Take me to gold bangles" → navigation, exactly as today.
3. When the LLM navigation step **times out** on a genuine navigation command, grounded navigation still
   rescues it and the customer is still taken to the page.
4. The disambiguation `options` flow still works for a genuine but ambiguous navigation command.
5. Every suppressed grounded attempt is visible in logs with its miss reason.

## Tests to add

`tests/unit/assistant-navigation.test.ts` — the partition function is pure and directly unit-testable:

- each explicit-negative reason → `isAssistantLlmNavigationRefusal` returns `true`
- each mechanical reason → returns `false`
- `undefined` → returns `false` (no miss recorded means step 1 succeeded or never ran)

That last case matters: `llmNavigationMissReason` is only assigned inside the `shouldTryLlmNavigation`
branch, so it is `undefined` when step 1 never ran, and the gate must not suppress grounded navigation then.

## Verification

```bash
npm run lint && npx tsc --noEmit && npm run test:unit
npx playwright test tests/e2e/assistant.spec.ts --project=chromium
npm run build
```

Live matrix — run all four by voice **and** typed, in `en` and `te`:

| Utterance | Expected |
|---|---|
| "do you have gold bangles" | answer |
| "take me to gold bangles" | navigate |
| "what is your return policy" | answer |
| "open the wishlist" | navigate |

## Rollback

Restore the original `if (shouldTryLlmNavigation)` gate. The helper can stay — it is inert without the
gate.
