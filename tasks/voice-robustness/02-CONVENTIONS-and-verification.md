# Conventions and verification — read before writing any code

## The two projects

The voice work spans **two repositories**:

| | Location | Runtime | Deploy target |
|---|---|---|---|
| Storefront | this repo (`src/`) | Next.js 16 App Router, React 19, Node 22 | Vercel → `bfg.darisi.in` |
| Voice service | [ajaydarisi/bfg-voice-agent](https://github.com/ajaydarisi/bfg-voice-agent) | NestJS 11 + native `ws`, own `package.json`, own `Dockerfile` | Render → `bfg-voice-agent.onrender.com`, single instance, region singapore |

The voice service used to live in `voice-agent/` here and was extracted in Aug 2026; task files
below still cite `voice-agent/…` paths, which now mean paths inside that repo. Its commands run
in a clone of it, not here. The browser reaches it via `NEXT_PUBLIC_VOICE_WS_URL`, and the two
sides share only the wire protocol (`src/lib/voice/protocol.ts` ↔ its `src/common/protocol.ts`,
hand-synced) and `VOICE_TOKEN_SECRET`.

## Hard rules (from CLAUDE.md — violating these fails review)

1. **Never add `Co-Authored-By` or any co-authorship line to a commit message.**
2. **Imports use the `@/` alias in the storefront. No relative imports.** In `voice-agent/` imports are
   relative with explicit `.js` extensions (ESM + `"type": "module"`) — match the surrounding file.
3. Files kebab-case, components PascalCase, functions camelCase, booleans `is/has/can/should`,
   constants UPPER_SNAKE_CASE.
4. Business/pricing rules live in `src/lib/product-pricing.ts` or `src/lib/constants.ts`, never inline
   in components.
5. Any new user-facing string needs an entry in **both** `messages/en/<ns>.json` **and**
   `messages/te/<ns>.json`. A missing `te` file or key breaks the Telugu locale.
6. Server actions return `{ success, error?, data? }` and call `revalidatePath()` after mutations.
   (No task in this plan adds a server action, but do not break the pattern if you touch one.)

## Style rules specific to this codebase

The voice stack is deliberately **minimal and densely commented**. Match it:

- **Smallest correct diff.** If your fix is larger than the bug, it is the wrong fix.
- **One fix in the shared function, not N fixes in N callers.** Grep for every caller before editing.
- **No new dependencies.** No new abstraction layers, factories, interfaces-with-one-implementation,
  config for a value that never changes, or "for later" scaffolding.
- **`ponytail:` comments mark accepted shortcuts with a named ceiling.** They are decisions, not bugs.
  Do not remove one without removing the shortcut it describes. If a task tells you a ponytail comment
  is now stale, delete the comment as part of that task.
- **Comments explain *why*, not *what*.** Every existing comment in the voice stack earns its place;
  new ones must too. Do not add narration.
- Non-trivial logic leaves **one runnable check** behind — an added case in the existing test file, not
  a new framework or fixture set.

## Verification commands

Run the relevant subset after every task; run all of it before landing the tier.

**Storefront:**
```bash
npm run lint
npx tsc --noEmit
npm run test:unit
npm run build
```

> `npx tsc --noEmit` currently reports **two pre-existing errors in generated `.next/` artifacts**
> (`PrefetchForTypeCheckInternal` and a stale `src/app/api/widget/example/route.js` reference in
> `.next/types/validator.ts`). These are build-artifact noise, not source errors, and were present
> before this plan. **Do not try to fix them, and do not treat them as a regression.** Source must
> produce zero *new* errors.

**Voice service:**
```bash
cd voice-agent
npm test
npm run typecheck
npm run build
npm audit --omit=dev
```

Baseline recorded 2026-08-06: `voice-agent` typechecks clean and **12/12 tests pass**. Any task that
leaves a failing test is not done.

**E2E (assistant + voice):**
```bash
npx playwright test tests/e2e/assistant.spec.ts --project=chromium
```

**Sentence chunker self-check** (a runnable `__main__`-style check already exists):
```bash
cd voice-agent && npx tsx src/common/sentence-chunker.ts
```

**Native sync** — required after any change under `android/` or `ios/`:
```bash
npm run cap:sync
```

## Manual smoke test (from docs/voice-assistant-production.md, still current)

Do this in **both English and Telugu**, on desktop Chrome **and** one real Android device, after Tier 0:

1. Open Ask AI, start voice → UI shows Connecting, then Listening.
2. Speak a product request **with a short pause in the middle** → nothing is sent during the pause.
3. Finish speaking → one combined user message appears after the quiet window (~1.4s).
4. Answer text grows while the request is still in flight; first audio starts after the first complete
   sentence, before product cards attach.
5. Speak while the answer is being read → playback stops, Listening resumes.
6. Keep speaking while the assistant is Thinking → the stale request disappears, replaced by the
   combined turn.
7. Deny microphone permission → localized recovery message.

## Existing test files you will extend (do not create new ones unless told)

| File | Covers |
|---|---|
| `voice-agent/tests/voice-session.test.ts` | session state machine, settle window, barge-in, speech streaming (12 cases, injects a fake `openTts` via `VoiceSessionDependencies`) |
| `voice-agent/tests/protocol.test.ts` | `parseClientMsg` bounds, token rotation |
| `voice-agent/tests/stt-buffer.test.ts` | STT backpressure high-water mark |
| `tests/unit/assistant-navigation.test.ts` | navigation sanitization |
| `tests/unit/assistant-language.test.ts` | language detection |
| `tests/unit/sentence-stream.test.ts` | client sentence splitter |
| `tests/e2e/assistant.spec.ts` | assistant + voice end-to-end, incl. `speak_start` language assertions at `:787` and `:822` |

`VoiceSession`'s constructor takes a `VoiceSessionDependencies` object
(`voice-agent/src/session/voice-session.ts:19-24`) with `stt`, `openTts`, `assistantSettleMs`,
`assistantResponseTimeoutMs` — this is the seam every existing test uses. Use it; do not add a new one.

## Environment variables touched by this plan

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_VOICE_WS_URL` | storefront | absent ⇒ all mic UI hidden (kill switch) |
| `VOICE_TOKEN_SECRET` | both | must match; ≥32 chars in production |
| `VOICE_TOKEN_PREVIOUS_SECRET` | voice service | rotation only |
| `ALLOWED_ORIGINS` | voice service | required in production, exact comma-separated origins |
| `SARVAM_API_KEY` | voice service | STT + TTS |
| `GEMINI_API_KEY` | both | brain + embeddings |
| `AI_HTTP_TIMEOUT_MS` | storefront | clamped 5–30s, default 12s (`src/lib/ai/gemini.ts:15-18`) |
| `MAX_CONCURRENT_SESSIONS` | voice service | default 8 (T2-1 adds a per-client cap alongside it) |
| `VOICE_ALLOW_CONVERSATION_MODE` | voice service | **new in T2-3** |

`voice-agent/.env.example` is referenced by `voice-agent/src/common/env.ts:7` and
`docs/voice-assistant-production.md:56` but **does not exist**. T2-5 creates it.

## Documentation to update when you finish a tier

- `docs/voice-assistant-production.md` — the operational contract. Update the monitoring section when
  T3 lands, and the capacity section when T2 lands.
- `docs/voice-assistant-build-plan.md` — **historical**. It still describes Claude as the LLM; the code
  moved to Gemini (`voice-agent/src/llm/index.ts:9`). Do not update it to match the code; do not treat
  it as current. Its value is that it records what was deliberately deferred.
- `tasks/lessons.md` — per CLAUDE.md, append a lesson after any correction from the user.
- `tasks/todo.md` — currently holds the Render deployment log with one open item (add
  `NEXT_PUBLIC_VOICE_WS_URL` to Vercel production). Do not overwrite it.
