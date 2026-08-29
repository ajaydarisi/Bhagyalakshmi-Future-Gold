# T1-8 — The silence re-prompt is hard-coded Telugu, and an English session speaks it with an English voice

| | |
|---|---|
| **Severity** | medium |
| **Confidence** | `verified` |
| **Effort** | S |
| **Category** | i18n |
| **Files** | `voice-agent/src/session/voice-session.ts:102`, `:248-256`, `:310` |
| **Sequencing** | none. Do with or after T1-7 (same canned-utterance path). |

## Symptom

An English-locale customer goes quiet. The assistant speaks Telugu words — rendered by an **English**
voice, so it comes out as mangled phonetic nonsense. The same happens on the LLM-error apology in
conversation mode.

## Verified root cause

Two hard-coded Telugu strings, and a language argument that is never passed.

**String 1 — the watchdog re-prompt**, `voice-agent/src/session/voice-session.ts:101-104`:

```ts
            this.log("STT watchdog: still nothing — spoken re-prompt");
            this.speakCanned("క్షమించండి అండి, సరిగ్గా వినపడలేదు. మళ్ళీ చెప్పండి?");
```

**String 2 — the LLM-error apology** (conversation mode), `:309-311`:

```ts
        // Spoken apology keeps the interaction alive (plan §Phase 6 matrix).
        const apology = "క్షమించండి అండి, కొంచెం సేపు ఆగి మళ్ళీ అడగండి.";
        onSentence(apology);
```

**Why the voice is wrong too.** `speakCanned` calls `openTts` with no language argument (`:251`):

```ts
    const tts = this.openTts(id, Date.now());
```

and `openTts`'s parameter defaults to the session field (`:192-196`):

```ts
  private openTts(
    id: number,
    t0: number,
    languageCode: VoiceTtsLanguageCode = this.assistantTtsLanguageCode,
  ): TtsUtterance {
```

`assistantTtsLanguageCode` is set from the connect-time language (`:56-57`):

```ts
    this.assistantTtsLanguageCode =
      languageCode === "en-IN" ? "en-IN" : "te-IN";
```

So when the browser connected with `lang=en` (`voice.gateway.ts:57-63` maps it to `en-IN`), the canned
**Telugu text** is synthesized by the **`en-IN` Bulbul voice**. That is strictly worse than either
consistent option.

Note this is the one place BFG is behind on a Sarvam *default layer*: graceful long-silence handling ships
enabled in Samvaad. BFG has the mechanism; it is just wrong for half its users.

## The change

### 1. Add a two-language string map

Near the top of `voice-agent/src/session/voice-session.ts`, beside `HISTORY_TURNS` (`:14`):

```ts
/** Canned spoken lines. Kept here rather than in the storefront's next-intl
 *  bundles because this service has no i18n runtime and only ever needs these
 *  two; the Telugu wording mirrors the register in llm/system-prompt.ts. */
const CANNED_SPEECH = {
  reprompt: {
    "te-IN": "క్షమించండి అండి, సరిగ్గా వినపడలేదు. మళ్ళీ చెప్పండి?",
    "en-IN": "Sorry, I did not catch that. Could you say it again?",
  },
  apology: {
    "te-IN": "క్షమించండి అండి, కొంచెం సేపు ఆగి మళ్ళీ అడగండి.",
    "en-IN": "Sorry, please wait a moment and ask again.",
  },
} as const satisfies Record<string, Record<VoiceTtsLanguageCode, string>>;
```

`VoiceTtsLanguageCode` is already exported from this file (`:16`).

**Do not** put these in `messages/*/voice.json`. That bundle is next-intl, loaded by the storefront; the
voice service has no i18n runtime and importing across the two projects is not possible (separate
`package.json`, separate build). Two strings in the file that speaks them is the right size. Note in the
comment that the storefront's `voice.json` is the place for *UI* strings, so nobody merges the two later.

### 2. Use it at both sites

`:102`:
```ts
-           this.speakCanned("క్షమించండి అండి, సరిగ్గా వినపడలేదు. మళ్ళీ చెప్పండి?");
+           this.speakCanned(CANNED_SPEECH.reprompt[this.assistantTtsLanguageCode]);
```

`:310`:
```ts
-       const apology = "క్షమించండి అండి, కొంచెం సేపు ఆగి మళ్ళీ అడగండి.";
+       const apology = CANNED_SPEECH.apology[this.assistantTtsLanguageCode];
```

`speakCanned` already resolves the TTS language from `assistantTtsLanguageCode` via `openTts`'s default,
so text and voice now agree with **no signature change**. That is why the map is keyed by
`VoiceTtsLanguageCode` rather than by `"en" | "te"` — it lines up with the field that already governs the
voice.

### 3. Confirm no other hard-coded spoken string exists

```bash
cd voice-agent && rg '[\p{Telugu}]' src/
```

Expect hits in `llm/system-prompt.ts` (correct — that is a Telugu-only prompt, and per
`01-CONTEXT-comparison-vs-sarvam.md` conversation mode is Telugu-only by design), in
`common/sentence-chunker.ts`'s self-check (correct — test data), and in `tests/`. Any *other* hit is a
missed site; fix it in this task.

## An important caveat about `assistantTtsLanguageCode`

This field is **mutable**: `startAssistantSpeech` reassigns it per utterance (`:404`) from the language the
storefront chose for that turn:

```ts
    this.assistantTtsLanguageCode = languageCode;
```

So after a Telugu turn in an `en`-connected session, the field is `te-IN`, and a subsequent canned
re-prompt would speak Telugu. **That is correct and desirable** — it tracks the language the customer is
actually being answered in, which is more accurate than the connect-time parameter. Do not "fix" it back
to the connect-time value.

It does mean the canned line's language depends on conversation history. Say so in a comment so the next
reader does not treat it as a bug.

## Blast radius

Two string literals inside one file. No signature changes, no protocol change, no storefront change. The
`speakCanned` guard (`:249`, `state !== "listening"` → return) is untouched.

## Acceptance criteria

1. Connect with `lang=en`, go silent → the re-prompt is spoken **in English with the English voice**.
2. Connect with `lang=te`, go silent → the Telugu re-prompt, unchanged from today.
3. After a Telugu-answered turn in an `en` session, a re-prompt speaks Telugu with the Telugu voice —
   text and voice agree either way.
4. Conversation mode's LLM-error apology follows the same rule.
5. `voice-agent` tests all pass; the Telugu scrubbing regression test at
   `voice-agent/tests/voice-session.test.ts:198-216` is unaffected.

## Tests to add

`voice-agent/tests/voice-session.test.ts` — the file already constructs sessions with an explicit language
(the test *"grounded speech can select Telugu TTS for a Telugu voice turn"* shows the pattern). Add:

> the silence re-prompt is spoken in the session's language

Construct with `languageCode: "en-IN"`, drive the watchdog (emit `END_SPEECH` with no transcript, advance
fake time past 5s + 3s), and assert the `assistant_text` frame contains the English string and the fake
`openTts` was opened with `"en-IN"`. Mirror it for `te-IN`.

Note: the existing tests inject `openTts`; capture its `languageCode` argument to assert on the voice, not
only the text. That is the assertion that actually catches this bug — text-only would have passed before
the fix for a Telugu session.

## Verification

```bash
cd voice-agent && npm test && npm run typecheck && npm run build
```

Live check, easiest trigger: start a session with the storefront in English, say one word, then stay
completely silent for ~10s.

## Rollback

Restore the two literals. Self-contained.

## Related, deliberately out of scope

Sarvam's long-silence layer also **wraps the call up gracefully** after repeated silence; BFG just
re-prompts and then relies on `sessionIdleMs` (120s) to end the session, which from the customer's side is
the panel silently disappearing. A polite spoken sign-off before `expire("session_idle")`
(`voice-session.ts:548-551`) would be a genuine improvement — but it is a **feature**, not a robustness
fix. Record it; do not build it here.
