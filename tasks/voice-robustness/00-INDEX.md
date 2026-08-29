# BFG Voice Agent — Robustness Implementation Plan (INDEX)

**Produced:** 2026-08-06 · **Branch at time of review:** `redesign/bfg-design-system` (a7dc77e)
**Audience:** an implementing model or engineer who has NOT seen the review. Read this file, then
`02-CONVENTIONS-and-verification.md`, then work the task files in the order below.

---

## How to use this plan

1. **Read `02-CONVENTIONS-and-verification.md` first.** It contains the repo rules, the exact
   verification commands, and the "do not do this" list. Violating it will get the change rejected.
2. **Read `99-REFUTED-do-not-fix.md` before proposing anything not in this plan.** Six plausible-looking
   issues were investigated and proven to be non-issues. Do not re-report or "fix" them.
3. Work tasks **in the order listed**. Where a dependency exists it is stated explicitly under
   *Sequencing* in the task file — it is not optional.
4. Each task file is self-contained: symptom, verified root cause with quoted current code, the exact
   edit, blast radius, acceptance criteria, verification commands, rollback.
5. Each task carries a **Confidence** field:
   - `verified` — the mechanism was read in the source and confirmed during the review. Implement it.
   - `verified-code / unverified-premise` — the code path is confirmed, but one environmental
     assumption needs a real device or provider check first. The task file states the check.
   There are **no** unverified tasks in this plan; everything unconfirmed was either verified or moved
   to `99-REFUTED-do-not-fix.md`.

## Execution order

| # | Task | File | Sev | Conf | Effort |
|---|---|---|---|---|---|
| **Tier 0 — voice is broken right now** | | | | | |
| T0-1 | Native apps declare no microphone permission | `T0-1-native-mic-permission.md` | critical | verified | S |
| T0-2 | Clean STT close (code 1000) silently deafens the session | `T0-2-stt-clean-close-recovery.md` | critical | verified | S |
| T0-3 | AudioContext never resumed after backgrounding | `T0-3-audiocontext-resume.md` | high | verified | S |
| **Tier 1 — customer-visible failures** | | | | | |
| T1-1 | LLM filter values are unvalidated free text → empty result pages | `T1-1-filter-value-validation.md` | high | verified | M |
| T1-2 | Grounded answer prompt has no spoken-output rules | `T1-2-spoken-output-prompt.md` | high | verified | S |
| T1-3 | Navigation runs on the raw transcript, not the refined one | `T1-3-navigation-uses-raw-transcript.md` | high | verified | M |
| ~~T1-4~~ | ~~Grounded nav overrides the LLM's "not navigation"~~ **WITHDRAWN — false positive, see the file** | `T1-4-grounded-nav-override.md` | — | refuted | — |
| T1-5 | Early chat failure strands the voice session in `thinking` 30s | `T1-5-voice-turn-early-failure.md` | high | verified | S |
| T1-6 | After a mid-answer failure every control is disabled ≤28s | `T1-6-error-state-recovery.md` | medium | verified | S |
| T1-7 | Barge-in is ignored during server-initiated speech | `T1-7-barge-in-canned-utterance.md` | medium | verified | S |
| T1-8 | Silence re-prompt is hard-coded Telugu, spoken by an English voice | `T1-8-localize-silence-reprompt.md` | medium | verified | S |
| T1-9 | Embedding retry can burn 24s of a 30s voice budget | `T1-9-embedding-retry-budget.md` | medium | verified | S |
| T1-10 | `sort=` is silently dropped whenever `q=` is present | `T1-10-search-sort-ignored.md` | medium | verified | M |
| T1-11 | iOS/Safari never enters `speaking`, so no Interrupt button | `T1-11-apple-playback-state.md` | medium | verified-code / unverified-premise | S |
| **Tier 2 — abuse and cost** | | | | | |
| T2 | 5 grouped items (session cap, audio metering, `mode=conversation`, `speak_reset` budget, `.env.example`) | `T2-abuse-and-cost.md` | medium | verified (adversarial) | S each |
| **Tier 4 — surface** | | | | | |
| T4 | Bring the voice agent out of the sidebar: floating call dock | `T4-voice-call-dock.md` | high | verified | M |
| **Tier 3 — make it debuggable** | | | | | |
| T3 | Structured turn latency, close-code attribution, cross-service correlation, TTS-leg tests | `T3-observability-and-tests.md` | medium | verified | M |

## Dependency graph

```
T0-2 ──▶ T0-3        (fix the STT close path first, or T0-3 masks T0-2 in staging)
T1-1 ──▶ T1-10       (T1-10 only matters once T1-1 lets sort+q reach the page together)
T0-1 ──▶ T1-11       (T1-11 cannot be tested on the iOS app until the mic permission exists)
T3-1 ──▶ everything else's acceptance check is easier, but it is not a hard dependency
```

Everything not joined by an arrow is independent and can be done in any order or in parallel.

## Suggested commits

One commit per task, message shape `fix(voice): <what changed>` — except Tier 2, which may land as a
single `fix(voice): close abuse and cost gaps in the voice gateway`. **Never add a `Co-Authored-By`
line** (CLAUDE.md, hard rule).

## Scope boundary — what this plan deliberately does NOT do

- No protocol redesign. The flat 8-message vocabulary stays. See `01-CONTEXT-comparison-vs-sarvam.md`.
- No new dependencies, no new abstraction layers, no queues, no shared package for the two
  `protocol.ts` files.
- No mid-call language switching. It is a real gap (Sarvam ships it) but it is a **feature**, not a
  robustness fix. It is written up at the end of `01-CONTEXT-comparison-vs-sarvam.md` as future work.
- No changes to the navigation manifest's core invariant (reverse-parse → re-serialize → byte-compare).
  That invariant is the best thing in this codebase. T1-1 tightens a value schema *inside* it; nothing
  else may weaken it.
