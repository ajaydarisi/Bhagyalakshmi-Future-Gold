# Task Log

## Offline store mode — suppress commerce flows — IN PROGRESS 2026-07-19

Goal: when `NEXT_PUBLIC_STORE_MODE=OFFLINE`, keep the storefront catalog and
WhatsApp availability experience while hiding and disabling cart, checkout,
payment, order, and address flows.

- [ ] Consolidate customer-commerce route availability and reuse it at every
  UI/server boundary.
- [ ] Prevent cart state and reusable commerce controls from initializing or
  mutating in offline mode.
- [ ] Keep direct offline commerce URLs redirected before their pages render;
  preserve the customer profile, wishlist, and catalog/contact experience.
- [ ] Ensure assistant, omnibox, retrieval, and external manifests cannot
  advertise unavailable commerce routes in offline mode.
- [ ] Add offline-mode regressions and run type, lint, unit, and build checks.

### Constraints

- Offline mode is catalog/contact-only; it uses WhatsApp availability actions.
- Do not erase a shopper's persisted cart simply because the deployment mode
  changes; keep it dormant until online mode is restored.
- Keep normal online behavior unchanged.

## Agentic storefront navigation — Phases 1–3 — COMPLETE 2026-07-19

Goal: make natural-language navigation a safe primary affordance without
removing conventional, crawlable, accessible storefront links.

- [x] Define one typed, bilingual route manifest with parameter schemas,
  serialization, availability metadata, and public-agent exports.
- [x] Preserve deterministic navigation as the no-model fast path; add a
  Gemini structured-output fallback only for unresolved navigation-shaped
  requests, with manifest validation and the existing URL sanitizer as the
  final trust boundary.
- [x] Emit resolver-source telemetry (deterministic / dynamic / LLM / miss)
  and prefetch accepted navigation targets before client-side transition.
- [x] Ground products, categories, static pages, and policy sections through
  bounded retrieval; retain safe ambiguity choices instead of guessing.
- [x] Add an accessible customer omnibox that uses the same safe path while
  keeping header, footer, and ordinary deep links intact.
- [x] Publish an agent-readable llms.txt / route-manifest surface generated
  from the same source of truth.
- [x] Add focused tests, then run type checking, lint, unit tests, and a
  production build with a supported Node runtime.

### Constraints

- The LLM selects a route ID and typed parameters; it never supplies a URL.
- Every generated navigation object passes `sanitizeAssistantNavigation`.
- User-owned and administrative routes remain subject to their existing auth
  checks, and no external or arbitrary URLs are valid assistant destinations.
- Existing static links remain available for SEO, accessibility, and degraded
  operation.

### Review — 2026-07-19

- `assistant-route-manifest.ts` is the canonical typed route source for
  deterministic parsing, database-backed entity resolution, LLM structured
  output, retrieval grounding, the omnibox, `llms.txt`, and the read-only MCP
  endpoint. A route serializes only after its route-specific Zod schema passes.
- The Gemini fallback receives only route IDs and parameter schemas, never URL
  templates. Its result must pass the manifest serializer and the existing
  `sanitizeAssistantNavigation` transport boundary; entity and private order
  routes cannot be selected by the model. Its 3-second budget is a hard
  result race, so a provider that ignores cancellation still degrades to
  retrieval rather than delaying a customer response.
- Retrieval may only select from bounded catalog/static-document candidates;
  it preserves ambiguity choices, rejects untrusted hrefs, and allows only
  manifest-owned document anchors.
- The persistent bilingual omnibox preserves conventional links, prefetches
  safe results, and shares deterministic/API resolution with Ask AI. Resolver
  source is attached to `assistant_navigation` telemetry.
- External consumers receive public, non-entity routes only through
  `/llms.txt`, `/.well-known/agent-navigation.json`, and a read-only
  Streamable HTTP MCP endpoint at `/api/mcp`.
- Verified with Node 22: TypeScript check, ESLint, `git diff --check`, 88
  passing unit tests (including all new navigation tests), and a successful
  production build. The full suite has one known, unrelated failure in
  `offline-ui-helpers.test.ts`: its rental maximum expects 2026-03-15 while
  the established inclusive-day implementation returns 2026-03-14.

## Ask AI navigation commands — COMPLETE 2026-07-18

Goal: allow the Ask AI panel to route a customer to a public storefront page or
to `/products` with URL-backed filters, from either typed input or a finalized
voice transcript. Navigation must be deterministic and locale-aware; the LLM
must not generate or authorize URLs.

- [x] Add a pure navigation resolver with a strict allow-list of public routes
  (including terms and conditions, privacy policy, about, visit, home, search,
  and products) and bilingual command recognition.
- [x] Reuse the existing product filter parser to build `/products` URLs,
  including the requested default of `type=rental&maxPrice=1000` for an
  otherwise-unqualified “show products under 1000” command.
- [x] Add the structured navigation payload to assistant replies and return it
  before retrieval/LLM generation for recognised commands, with localized
  acknowledgement text suitable for both the chat UI and TTS.
- [x] Have the shared client message-completion path navigate through
  next-intl’s router, close the assistant sheet, and retain cancellation/stale
  response protections for voice turns.
- [x] Add unit coverage for resolver output, URL encoding and locale behavior;
  add Playwright coverage for typed and mocked voice transcript navigation;
  run type checking, lint, focused tests, and a production build.

### Design decisions captured

- A request to **open/navigate/take me to** a page is a command. A question
  *about* a policy remains a grounded answer with citations.
- Only customer routes in `ROUTES` may be returned, and every destination is a
  relative internal URL. Protected customer pages retain their existing guards;
  admin and external URLs are never navigable by Ask AI.
- Direct authentication screens are excluded so a voice acknowledgement is not
  cut off by leaving the storefront layout; protected account routes continue
  to invoke their existing authentication guard.
- To match the stated example, a budget-only product request defaults to rental
  inventory; explicit buy/sale and rent/rental wording still overrides it.

### Review

- A deterministic resolver now runs before voice transcript refinement,
  retrieval, or LLM generation and returns only validated customer-facing
  destinations. Ambiguous questions remain on the grounded-answer path.
- English, Telugu script, and recognized Romanized Telugu use one language
  detector for answers and voice acknowledgement/TTS; unsupported language
  signals fall back to the selected storefront locale. Navigation preserves the
  selected storefront locale through the next-intl router.
- Navigation payloads validate their route, filter names, and filter values;
  stale voice turns cannot apply a late navigation result.
- Verified: `npx tsc --noEmit`, `npm run lint -- --quiet`, 29 focused Vitest
  tests, 12 Ask AI Playwright tests, and `npm run build`.
- The full Vitest suite has one pre-existing unrelated failure in
  `offline-ui-helpers.test.ts` (its rental-date maximum is one day earlier
  than the expectation); the other 47 tests pass.

## Ask AI website-guide — Phase 2 — DONE 2026-07-18

Goal: make Ask AI available across all localized customer pages and support
safe detail navigation for product and owned-order requests.

- [x] Move the assistant and its cart, wishlist, query, and network provider
  dependencies into the locale-level customer shell so it persists across
  storefront and authentication navigation.
- [x] Extend the deterministic allowlist for authentication/recovery pages and
  add validated dynamic product detail, owned order detail, and owned order
  confirmation destinations.
- [x] Add bounded server-resolved candidate choices for ambiguous products and
  orders, with typed selection and voice ordinal selection.
- [x] Preserve query-language acknowledgements, clear pending choices on
  cancellation/new request/timeout/navigation, and retain locale-aware routes.
- [x] Add focused unit and Playwright coverage for static routes, dynamic
  resolver behavior, route validation, auth availability, and selection flows.

### Review

- The assistant now remains mounted on every localized storefront and auth page;
  admin, OAuth bridge, and preview routes are still outside its reach.
- Product and order URLs are resolved server-side from allowlisted data, with
  ownership checks for orders and bounded, validated choices for ambiguity.
- Verified: `npx tsc --noEmit`, `npm run lint -- --quiet`, `git diff --check`,
  28 focused unit tests under the bundled Node 24 runtime, and all 15 Ask AI
  Playwright tests against the active local development server.
- The system Node 20 runtime cannot start this project's Vitest 4 dependency
  graph (the project requires Node 22+), so the bundled Node 24 runtime was
  used for unit tests. A production build was intentionally not run because
  the user's active Next development server owns the `.next` lock.

## Voice Assistant (live Telugu voice AI) — IN PROGRESS 2026-07-12

Spec: docs/voice-assistant-build-plan.md (verified against provider docs 2026-07-12)

- [x] Phase 1 — Sarvam STT + TTS test scripts — DONE 2026-07-12, all gates pass
  - Measured: STT processing_latency 60–265ms, VAD START/END events work, transcripts near-perfect vs ground truth
  - Measured: TTS TTFB 238–335ms (claim ~holds); `final` event ONLY with explicit send_completion_event=true in URL (doc default wrong; quiet-settle fallback kept)
  - Finding: TTS chunk boundaries are mid-MP3-frame → Phase 4 player must use MediaSource/stream reassembly, NOT per-chunk decodeAudioData
- [x] Phase 2 — LLM streaming + sentence chunker — DONE 2026-07-12, gates pass
  - SCOPE CHANGE (user): Sarvam LLM instead of Claude; Gemini allowed for small purposes
  - Measured: sarvam-30b streams 1,100–1,600 UNSUPPRESSIBLE reasoning tokens before every reply
    (reasoning_effort=low, chat_template_kwargs.enable_thinking=false, /no_think all ignored) = 4–6s dead air
  - Decision: Gemini (thinkingBudget: 0, honored) is default conversation LLM; LLM_PROVIDER=sarvam flips back
  - Measured (Gemini flash): first delta 1.9s, first sentence 2.1s, TTS first audio +233ms; abort drill clean in 5ms
- [x] Phase 3 — NestJS voice service — DONE 2026-07-12, gates pass
  - test-client full turn: transcript → assistant_text → audio (170 chunks) → utterance_end; bad token → 4401; healthz OK
  - Bonus: sample's 2nd utterance triggered the server-side barge-in backstop live (interrupt + correct new answer)
- [x] Phase 4 — Next.js frontend — DONE 2026-07-12 (verified except real-mic loop)
  - Widget mounts en+te, panel opens, mic-denied explainer works (pane blocks capture), token route mints JWTs
  - Player uses MediaSource (Phase 1 finding: chunks not frame-aligned); Safari falls back to whole-utterance decode
  - devIndicators moved top-left (dev badge collided with widget)
  - REMAINING (human): real mic+speaker session on desktop Chrome + Android
- [x] Phase 5 — Barge-in — CODE DONE 2026-07-12 (needs real-mic verification)
  - Client Silero VAD (@ricky0123/vad-web 0.0.30, onSpeechRealStart, shared echo-cancelled stream, lazy-loaded)
  - Acts only while assistant speaking; tap-to-interrupt shares the path; utteranceId gating both sides
  - Server §4.3 map proven live in Phase 3 (STT-backstop barge-in fired and recovered)
- [x] Phase 6 — Error handling — DONE 2026-07-13 (chaos subset verified)
  - STT: auth-rejection (401/403) → instant fatal, no retry — verified: bad key fails session in 317ms with stt_failed + close 1011
  - STT: retryable closes → 0.5→8s backoff then fatal; END_SPEECH-no-transcript watchdog → flush → spoken re-prompt
  - Client: one silent reconnect with fresh token, then error state; busy(4429)/mic-denied/disconnected all localized en+te
  - TTS mid-utterance failure → degrade to on-screen text (ponytail: resynthesis is the upgrade path)
  - Per-turn latency logs: turn N first sentence / first audio (measured +1074ms / +1340ms after transcript)
  - Session watchdogs (10min max / 2min idle) + origin check + healthz + concurrency cap in place from Phase 3

### Review — voice assistant (2026-07-13)
- Verified: tsc clean (app + voice-agent), eslint 0 warnings on new files, all script gates pass,
  full WS turn via test-client, bad-token 4401, bad-key 317ms graceful fail, widget renders en+te,
  mic-denied path works in browser preview, token route mints JWTs.
- NEEDS HUMAN (real mic/speakers): end-to-end spoken turn in Chrome, barge-in latency feel,
  Android test over deployed HTTPS, Safari fallback player. Then: deploy voice-agent (Railway/Fly),
  set prod env (ALLOWED_ORIGIN, NEXT_PUBLIC_VOICE_WS_URL=wss://…, VOICE_TOKEN_SECRET on Vercel).
- Deviations from plan doc: LLM = Gemini default (sarvam-30b unsuppressible reasoning = 4–6s dead air;
  LLM_PROVIDER=sarvam flips back); session.manager.ts folded into gateway; guard file replaced by
  handleConnection check (plan's own gotcha); MSE player instead of per-chunk decode (Phase 1 finding).

### Review follow-up — cancellation and STT backpressure (2026-07-18)
- [x] Make the voice-transcript refinement request abort when its 2.5s budget or the client request ends.
- [x] Bound Sarvam STT's outbound WebSocket queue and drop stale audio above a configurable high-water mark.
- [x] Add focused regression coverage and run lint, type checks, and the applicable test suites.

#### Review — 2026-07-18
- `generateJson` now forwards an `AbortSignal`; transcript cleanup owns a controller cancelled by either
  its 2.5-second deadline or the incoming request's cancellation.
- The voice agent drops upstream audio once `MAX_STT_BUFFERED_BYTES` (default 256 KiB) is queued.
- Verified: app type check, voice-agent build + 12 tests, app lint, focused app unit tests (6), and
  production build all pass. The full app unit suite has one unrelated existing failure in
  `offline-ui-helpers.test.ts`'s rental end-date expectation (expected 2026-03-15, receives 2026-03-14).

### Voice turn race — stale final reply (2026-07-18)
- [x] Prevent a cancelled voice request from finalizing after a newer turn is active.
- [x] Add a regression test covering cancellation after streamed deltas but before the final result is applied.

#### Review — 2026-07-18
- Cause: `sendMessage()` did not revalidate request ownership after `readAssistantStream()` returned, so a
  first voice turn cancelled during final stream delivery could still return its answer and resume stale speech.
- Fix: discard a final reply unless it remains the active, uncancelled request; regression coverage verifies a
  cancelled first turn cannot finalize while a second turn is active.
- Verified: app type check, lint, focused app unit tests (7), voice-agent tests (12), and production build.


## Dedicated Rental Flow (v2) — DONE 2026-07-03

Design approved 2026-07-02 (D1 allow mixed carts · D2 sale/rental flags mutually exclusive · D3 daily pricing · D4 deposit out of scope · D5 booked→active→returned, overdue derived · D6 extensions/late fees out of scope).

### Implementation
- [x] Migration 011/012: rental order fields, increment_product_stock RPC, self-block fix in getBookedRanges
- [x] productSchema: is_sale/is_rental mutually exclusive (rental never sold)
- [x] lib/rental-availability.ts: getBookedRanges, maxConcurrentBooked (per-day peak), isRentalOverdue, countsAsBooked
- [x] createOrder: availability check per rental line + order_type + rental pricing
- [x] verifyPayment + webhook: pending→paid as fulfillment lock; rental lines skip stock; rental_status='booked'; coupon increment
- [x] updateOrderStatus: guards + delivered→active, cancelled/refunded restore sale stock via RPC
- [x] markRentalReturned admin action
- [x] GET /api/rentals/availability + RentalDatesDialog
- [x] Admin UI for rentals, customer order views, i18n
- [x] tests/rental-logic-check.ts

### Review / evidence
- tsc clean; eslint clean.
- tests pass. Live checks on Prod.
- Accepted: concurrent checkout race (pre-payment); soft-holds via pending.

## Follow-up: storage lockdown, leaked-password UX, design tokenization + security (2026-07)

### (a) Storage bucket listing lockdown — DONE
- [x] migrations 008-010: drop broad public SELECT policies on product-images & public-downloads; storage.sql update
- [x] applied to BFG Prod + verified

### (b) Leaked-password protection — CODE DONE / TOGGLE PENDING
- [x] signup-form + reset-password-form: map weak_password error -> friendly message + i18n
- [ ] (MANUAL) enable in Supabase Dashboard Auth policies

### (c) Design tokenization + contrast — DONE
- [x] gold rgb tokens, muted-foreground contrast

### (d) Security hardening follow-ups (RLS, RPCs, admin auth, payment binding)
- [x] requireAdmin() extracted + used on all admin actions + ai routes
- [x] device token binding to session only
- [x] payment verify uses tx lookup + ownership check
- [x] search_path pinned on functions; RLS tweaks; new RPCs (increment stock)
- [x] migrations 008_security_hardening, 009_followup, 010_storage

### Review
- Migrations applied; advisor items addressed.
- tsc / eslint clean.

## Notes
- See also CLAUDE.md, tasks/codebase-analysis.md for ongoing items.

## Assistant navigation filter bugs (2026-07-19) — DONE
- [x] Tag phrases (Trending / New / Best Seller / Limited Edition, en+te) → `tag=` param instead of free-text `q=` (`lib/assistant.ts` ASSISTANT_TAG_PATTERNS)
- [x] Material phrases (Gold Plated, Antique, CZ, …) → `material=` param
- [x] minPrice: "above/over/at least N" + ranges "between X and Y" / "X నుండి Y" (min>max swapped)
- [x] `sort=price-asc` on explicit cheapness cues only (not on plain "under N")
- [x] Navigation verbs no longer leak into q ("take me to the products page" → /products)
- [x] "new arrivals" recognised as a product browse target
- [x] Pre-existing Telugu bug: normalizeAssistantSearchPhrase stripped combining marks (\p{M}), shredding Telugu queries; Telugu verbs/postpositions now stripped from q
- [x] Extraction lives in buildAssistantSearchFilters (shared), so RAG retrieval also gets tags/materials/minPrice

### Review
- Verified: 27-case probe battery on compiled modules (all pass), sanitizer round-trip (all pass), repo tsc + eslint clean, and live end-to-end in the widget: "Show me trending products" → /en/products?tag=Trending, "Show me products that are under 1000" → /en/products?type=rental&maxPrice=1000.
- Regression tests added to tests/unit/assistant-navigation.test.ts (NOTE: vitest cannot run on local Node 20.15.1 — needs Node ≥ 20.19 for require(esm); tests will run in CI/after node upgrade).
- Skipped: category-name → `category=` slug mapping (needs a DB lookup in a client-safe module; `q=` full-text search covers it). Rental default on any maxPrice kept per spec, so ranges also default to type=rental; min-only queries don't.
