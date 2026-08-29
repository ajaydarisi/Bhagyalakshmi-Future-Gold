# T1-3 — All three navigation resolvers run on the raw STT transcript, never the refined one

| | |
|---|---|
| **Severity** | high |
| **Confidence** | `verified` (and **broader** than first reported) |
| **Effort** | M — it is a reordering, and ordering here is load-bearing |
| **Category** | correctness |
| **File** | `src/app/api/assistant/chat/route.ts` |
| **Sequencing** | **Before T1-4.** Both edit the same navigation block; do this reorder first. |

## Symptom

Spoken navigation requests miss far more often than typed ones. "నన్ను గాజుల పేజీకి తీసుకెళ్లండి" comes
back from STT with a recognition error in one word, the navigation matcher does not fire, and the
customer gets a general answer instead of being taken to the page. Retrying with clearer diction
sometimes works, which makes it feel unreliable rather than broken.

## Verified root cause

The route deliberately refines a voice transcript before reasoning over it —
`src/app/api/assistant/chat/route.ts:976-985`:

```ts
    if (payload.source === "voice") {
      const refined = await refineAssistantVoicePrompt(latestUserMessage, signal);
      if (refined !== latestUserMessage) {
        latestUserMessage = refined;
        const lastUserIndex = messages
          .map((message) => message.role)
          .lastIndexOf("user");
        if (lastUserIndex >= 0) {
          messages[lastUserIndex] = { role: "user", content: refined };
        }
```

`latestUserMessage` is a `let` (declared `:872`) and is genuinely reassigned. **But refinement happens at
line 976, and all three navigation resolvers run before it or on a pre-refinement copy:**

| Resolver | Where | Input | Refined? |
|---|---|---|---|
| `resolveAssistantDynamicNavigation` | `:892` | `latestUserMessage` | **No** — runs 84 lines before refinement |
| `resolveAssistantLlmNavigation` | ~`:940-971`, ends `llmNavigationMissReason = llmNavigation.reason` at `:971` | `latestUserMessage` | **No** — still pre-refinement |
| `resolveAssistantGroundedNavigation` | `:1043-1049` | `query: languageSourceMessage` | **No** — `languageSourceMessage` is the *frozen raw* copy |

`languageSourceMessage` is captured at `:887` with an explicit and **correct** rationale (`:885-887`):

```ts
    // Voice clean-up may improve wording, but it must never decide the
    // response language: that belongs to the customer's original transcript.
    const languageSourceMessage = latestUserMessage;
```

That reasoning is right for language detection and wrong for navigation matching. Grounded navigation
inherited the raw copy because it is textually adjacent, not because anyone decided navigation should see
raw text.

Net effect: refinement only benefits retrieval and answer generation. The navigation matchers — which are
the most literal, most brittle consumers of the transcript, full of exact-phrase regexes in
`src/lib/assistant-navigation.ts:41-66` (English verbs, Telugu verbs, and romanized Telugu like
`teesukellandi|vellandi|teravandi`) — get the unrefined text with all its ASR noise. This is exactly
backwards: the component that most needs clean input is the one denied it.

## The change

Move voice refinement **above** the navigation block, keeping `languageSourceMessage` raw.

### Target ordering

```
:872   latestUserMessage  = last user message (raw)
:887   languageSourceMessage = latestUserMessage        ← STAYS HERE, stays raw
:888   responseLocale = detectAssistantLanguage(languageSourceMessage, requestedLocale)
NEW    if (isVoiceTurn) { latestUserMessage = await refineAssistantVoicePrompt(...); patch messages[] }
:892→  resolveAssistantDynamicNavigation({ ..., latestUserMessage })     ← now refined
:940→  resolveAssistantLlmNavigation(... latestUserMessage ...)          ← now refined
:1043→ resolveAssistantGroundedNavigation({ query: latestUserMessage })  ← CHANGE from languageSourceMessage
```

### Step 1 — hoist the refinement

Cut the whole `if (payload.source === "voice") { … }` block from `:976` and paste it immediately after
the `responseLocale` assignment at `:888`, before `resolveAssistantDynamicNavigation` at `:892`.

Use the `isVoiceTurn` constant introduced in **T1-2** if that task landed first; otherwise keep
`payload.source === "voice"` and let T1-2 hoist it.

### Step 2 — point grounded navigation at the refined text

`:1044`:

```ts
      const groundedNavigation = resolveAssistantGroundedNavigation({
-       query: languageSourceMessage,
+       query: latestUserMessage,
        locale: responseLocale,
        retrievedContext: firstItems,
        pageContext,
      });
```

### Step 3 — leave language detection alone

`languageSourceMessage` must keep feeding `detectAssistantLanguage` **only**. After step 2, check whether
it has any other reader:

```bash
rg "languageSourceMessage" src/app/api/assistant/chat/route.ts
```

If `detectAssistantLanguage` is its sole remaining consumer, add a short comment saying so, so nobody
"simplifies" it away later. Do **not** delete it and do **not** switch language detection to the refined
text — the comment at `:885-887` explains why, and `tests/e2e/assistant.spec.ts:787` / `:822` pin the
behaviour by asserting `speak_start` carries `language: 'te'` for a romanized-Telugu query and `'en'` for
an English one. **Those two tests must still pass unchanged.**

## The latency question you must answer before landing

Moving refinement earlier puts one extra LLM round trip **in front of** the navigation fast path. Today a
typed-style navigation command can return without ever calling `refineAssistantVoicePrompt`; after this
change every voice turn pays for it before any navigation can resolve.

Measure it. `refineAssistantVoicePrompt` is declared at `route.ts:128`; it is bounded by the shared Gemini
HTTP timeout (`src/lib/ai/gemini.ts:29`, `AI_HTTP_TIMEOUT_MS`, default 12s) and already falls back to the
raw transcript on timeout or error, and rejects its own rewrite when Telugu script is lost (`:165`) —
those guards are good and must be preserved.

Decision rule:
- If refinement typically costs **≲300ms**, hoist unconditionally as described. Better navigation
  accuracy is worth it.
- If it is **slower or highly variable**, run it concurrently instead of sequentially: start the
  refinement promise at `:888`, let `resolveAssistantDynamicNavigation` (which is cheap, deterministic and
  regex-driven) race on the raw text, and `await` the refinement only before the **LLM** and **grounded**
  navigation steps, which are the two that benefit most. Do not add a timeout of your own — the client
  timeout already exists.

Record the measured number in the PR description. This interacts with **T1-9** (embedding retry budget):
both add to the same 30s server / 28s client voice budget, so land T1-9 before or with this if the
measurement is marginal.

## Blast radius

- `resolveAssistantDynamicNavigation` now receives refined text. It resolves product and order entities
  from live data (`src/lib/assistant-navigation-resolver.ts:135-175`, `:242-262`) — refinement should
  *improve* slug and order-reference matching, but verify with an order-reference case, since refinement
  could in principle mangle an alphanumeric reference. If it does, exclude order references from
  refinement rather than reverting this task.
- Typed turns are entirely unaffected — the refinement block is voice-gated.
- The `messages[lastUserIndex]` patch moves with the block, so retrieval and the answer prompt still see
  the refined text exactly as they do today.

## Acceptance criteria

1. A voice navigation request containing a plausible ASR error in one word still navigates correctly.
2. Language detection is unchanged: `tests/e2e/assistant.spec.ts:787` and `:822` pass untouched.
3. A typed navigation request behaves identically to before.
4. Order-reference navigation ("show my order two three four") still resolves.
5. Measured added latency on the voice path is recorded and accepted.

## Tests to add

In `tests/unit/assistant-navigation.test.ts` (unit-level, no LLM): assert that
`resolveAssistantDynamicNavigationIntent` and the grounded matcher fire for a *clean* phrase and do not
fire for a *corrupted* one — this documents the dependency on refinement and will fail if someone reverts
the ordering.

Full end-to-end proof needs a real STT error, which is not unit-testable. Cover it in the manual smoke
test instead and note the phrases used.

## Verification

```bash
npm run lint && npx tsc --noEmit && npm run test:unit
npx playwright test tests/e2e/assistant.spec.ts --project=chromium
npm run build
```

Live, both locales, with both services up. Log the raw and refined transcripts side by side for five
spoken navigation requests and confirm navigation now keys off the refined one.

## Rollback

Move the block back to `:976` and restore `query: languageSourceMessage`. Self-contained.
