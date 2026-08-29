# T1-2 — The grounded answer prompt has no spoken-output rules, and the good prompt is on the dead code path

| | |
|---|---|
| **Severity** | high |
| **Confidence** | `verified` |
| **Effort** | S |
| **Category** | ux / quality |
| **Files** | `src/lib/retrieval/answer.ts`, `src/app/api/assistant/chat/route.ts` |
| **Sequencing** | none. Highest quality-per-line change in the plan — consider doing it first in Tier 1. |

## Symptom

Spoken replies are shaped like written text: too long, occasionally list-like, and prices come out as
`₹25,000` — which the TTS reads awkwardly instead of as "ఇరవై ఐదు వేల రూపాయలు". The reply drags on past
the point the customer wanted, which also makes barge-in the primary interaction rather than an
exception.

## Verified root cause

**The route knows it is a voice turn.** `src/app/api/assistant/chat/route.ts:976`:

```ts
    if (payload.source === "voice") {
      const refined = await refineAssistantVoicePrompt(latestUserMessage, signal);
```

**That knowledge never reaches the answer prompt.** `src/lib/retrieval/answer.ts:356-361`:

```ts
function buildPrompt(args: {
  messages: CatalogMessage[];
  locale: string;
  retrievedContext: RetrievedContextItem[];
  responseMode: GroundedResponseMode;
  pageContext?: AssistantPageContext | null;
}) {
```

No voice/spoken flag. A grep for `voice|spoken|speak` across the whole of `answer.ts` returns exactly
**one** hit — a Telugu-script instruction at `:365`:

```ts
  const localeInstruction =
    args.locale === "te"
      ? "Reply only in Telugu, using Telugu script for the answer. Natural shop English words like gold, design, rental, order, gram, and delivery are allowed when Telugu speakers would normally use them."
      : "Reply only in English.";
```

and the style instruction at `:372-375` is written for a screen:

```ts
  const styleInstruction =
    args.responseMode === "search_answer"
      ? "Give a concise shopping-oriented summary based only on the grounded catalog context."
      : "Act like a helpful shopping assistant, but stay grounded strictly in the provided context.";
```

**Meanwhile the excellent spoken ruleset already exists — on the path production does not use.**
`voice-agent/src/llm/system-prompt.ts:13-17` is used only by `conversation` mode
(`voice-agent/src/session/voice-session.ts:294`), and production runs `assistant` mode:

```
Speaking style — hard rules, your output goes straight to a speech engine:
- One to three short sentences per reply, at most about 35 words total. One idea at a time. Ask at most one question per reply.
- Plain sentences only: no markdown, no bullet points, no numbered lists, no emojis, no parentheses, no quotation marks, no abbreviations, no URLs.
- Say numbers and prices the way people speak them: "ఇరవై ఐదు వేల రూపాయలు", never "₹25,000".
- End every sentence with a period or question mark — the reply is split into sentences for speech synthesis.
```

So the best prompt in the repo is on the dead path and the live path has no spoken rules at all.

**What the voice service can and cannot compensate for.** `appendAssistantSpeech`
(`voice-agent/src/session/voice-session.ts:420-430`) scrubs a lot:

```ts
    const text = rawText
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/[*_`#>~]/g, "")
      .replace(/\s+([,.!?।])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
```

That handles markdown, links and bracketed glosses — and it is load-bearing, with a Telugu regression
test at `voice-agent/tests/voice-session.test.ts:198-216`. **Do not touch it.** But it cannot fix
`₹25,000`, cannot shorten a five-sentence answer, and cannot turn a numbered list into prose (stripping
`#`/`*` leaves the list *structure* as run-on fragments). Those are prompt-level properties. Fix them at
the prompt.

## The change

### 1. Thread the flag

`src/lib/retrieval/answer.ts` — add one optional arg to `buildPrompt`:

```ts
 function buildPrompt(args: {
   messages: CatalogMessage[];
   locale: string;
   retrievedContext: RetrievedContextItem[];
   responseMode: GroundedResponseMode;
   pageContext?: AssistantPageContext | null;
+  spokenOutput?: boolean;
 }) {
```

Add the same optional field to `generateAssistantGroundedReply`'s args (`:484`) and pass it through to
`buildPrompt`. Check whether `generateGroundedReply` (`:449`) also needs it — if `/api/search/answer`
never speaks, leave that one alone.

### 2. Add the spoken block

In `buildPrompt`, after `styleInstruction`, add:

```ts
  // Voice turns go straight to a speech engine. Rules mirror
  // voice-agent/src/llm/system-prompt.ts, which governs the conversation-mode
  // path; keep the two in sync when either changes.
  const spokenInstruction = args.spokenOutput
    ? [
        "This reply will be read aloud by a speech engine.",
        "Use one to three short sentences, about 35 words maximum. One idea per reply. Ask at most one question.",
        "Plain sentences only: no markdown, no bullet points, no numbered lists, no emojis, no parentheses, no quotation marks, no abbreviations, no URLs.",
        "Write numbers and prices as words the way a person says them, never as digits with a currency symbol.",
        "End every sentence with a period or a question mark, because the reply is split into sentences for synthesis.",
      ].join(" ")
    : "";
```

Include `spokenInstruction` in the assembled prompt. **Place it after** the locale and style
instructions so it wins on conflict, and only emit the line when non-empty so typed-chat prompts are
byte-identical to today (this keeps typed-chat output stable and makes the diff safe to review).

### 3. Pass it from the route

At the `generateAssistantGroundedReply` call sites in `src/app/api/assistant/chat/route.ts` (there are at
least two — the first attempt and the broadened retry around `:1208`), pass
`spokenOutput: payload.source === "voice"`.

`payload.source` is already in scope — it is read at `:976`. Prefer hoisting it into a single
`const isVoiceTurn = payload.source === "voice";` near where `latestUserMessage` is established
(`:872`), then use that constant at `:976`, at both generate calls, and in **T1-9** which needs the same
flag. One constant, four readers.

### 4. Add the Telugu spoken-register line

The conversation prompt's register guidance is the other half of what makes it good
(`voice-agent/src/llm/system-prompt.ts:9`): natural spoken Telugu (వాడుక భాష), not formal written
Telugu (గ్రాంథిక భాష), with `-అండి` politeness. When `spokenOutput && locale === "te"`, append that too.
Written Telugu read aloud sounds stilted to an Andhra customer, and the current `localeInstruction` says
nothing about register.

## Do NOT do these

- **Do not delete `voice-agent/src/llm/system-prompt.ts`.** It still governs `conversation` mode.
  Cross-reference the two in comments (as above) so a future edit updates both.
- **Do not move the scrubbing regexes out of `appendAssistantSpeech`.** They are the belt to the prompt's
  braces, and they have a pinned regression test.
- **Do not shorten the on-screen answer.** Voice and text render from the *same* stream, so the answer
  the customer reads is the answer they hear. That is a real constraint of this design: shortening for
  voice shortens the visible answer too. It is acceptable — a voice-initiated turn is a voice
  interaction, and the terminal `result` event still attaches full product cards, images and citations
  (`docs/voice-assistant-production.md:13`). **Say so in the PR description** so a reviewer does not
  mistake it for a regression.

## Blast radius

`buildPrompt` is module-private to `answer.ts`. The new field is optional and defaults falsy, so typed
chat and `/api/search/answer` are unaffected. Because prompts are inputs to a model, **there is no
compile-time check that this works** — the acceptance criteria below are the only real verification.

## Acceptance criteria

Voice turn, Telugu:
1. Reply is 1–3 sentences, ≤ ~35 words.
2. Prices are spoken as words. No `₹`, no digit-grouped numerals in the answer text.
3. No markdown, list markers, URLs or abbreviations in the answer text.
4. Register reads as spoken Telugu, not formal written Telugu.
5. Every sentence ends in `.` / `?` / `।` so `SentenceStream` (`src/lib/voice/sentence-stream.ts:1`)
   splits cleanly and TTS starts on the first sentence.

Voice turn, English: (1)–(3) and (5) hold.

Typed turn: output is unchanged from before this task (spot-check three prompts against `main`).

## Verification

```bash
npm run lint && npx tsc --noEmit && npm run test:unit && npm run build
npx playwright test tests/e2e/assistant.spec.ts --project=chromium
```

Then live, with both services running, ask by voice in Telugu and in English:
- "ఈ నెల ఆఫర్లు ఏమున్నాయి?" / "what offers do you have this month"
- "gold bangles ధర ఎంత?" / "how much are gold bangles"

Record the answer text from the NDJSON stream and check it against the five criteria. A convenient
observation point is the `assistant_text` frames the voice service echoes back
(`voice-agent/src/session/voice-session.ts:445`) — they are the post-scrub text that is actually spoken.

## Rollback

Remove the `spokenOutput` field and its three call sites. Typed chat was never affected.
