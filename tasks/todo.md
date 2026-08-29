# Voice agent deployment

- [x] Inspect the voice-agent runtime, required environment variables, repository branch, and existing Render resources.
- [x] Create the Render voice web service with production configuration; `SARVAM_API_KEY` remains pending manual entry in Render.
- [x] Verify the Render health/readiness endpoints and WebSocket service URL after `SARVAM_API_KEY` is added.
- [ ] Add `NEXT_PUBLIC_VOICE_WS_URL` to the Vercel production environment and trigger/verify the storefront deployment; the connected dashboard currently requires sign-in.
- [x] Record deployment URLs, verification results, and any follow-up configuration in the review section.

## Review

Render service created: `bfg-voice-agent` (`srv-d9nghanqj5pc73erlsqg`), URL `https://bfg-voice-agent.onrender.com`, branch `redesign/bfg-design-system`, region `singapore`. The initial build failure was fixed by setting `NPM_CONFIG_PRODUCTION=false` so `npm ci` retains TypeScript build dependencies under `NODE_ENV=production`. Render is live; health/readiness and signed WebSocket smoke checks pass. Vercel environment update is pending authenticated dashboard access.

# Voice agent robustness

Full implementation plan lives in [`tasks/voice-robustness/`](voice-robustness/00-INDEX.md) — 17 files,
one per task, each with verified root cause, exact edit, acceptance criteria and verification commands.
Start at `00-INDEX.md`.

- [x] **Tier 0** (voice is broken now): native mic permission · STT clean-close recovery · AudioContext resume
- [x] **Tier 1** (customer-visible; T1-4 withdrawn as a false positive — see its task file): filter-value validation · spoken-output prompt · navigation on refined
      transcript · grounded-nav override · early-failure strand · error-state recovery · canned-utterance
      barge-in · localized re-prompt · embedding retry budget · search sort · Apple playback state
- [x] **Tier 2** (abuse/cost): per-client session cap · audio metering · gate `mode=conversation` ·
      `speak_reset` budget · `.env.example`
- [x] **Tier 3** (debuggability): structured turn latency · disconnect attribution · cross-service
      correlation · TTS-leg tests
