# Context: how the BFG voice agent compares to Sarvam's own runtime

Read this once for orientation. It explains *why* the tasks are what they are, and — more importantly —
which parts of the codebase are already better than the reference and must not be touched.

## The two systems

Sarvam runs their own docs assistant on `docs.sarvam.ai` using their Samvaad runtime. It was
reverse-engineered from their published docs (`/conversations/build/run-time`,
`/conversations/build/concepts/harness`) and their shipped client bundle
(`unpkg.com/sarvam-convai-embed@1.0.19` plus a custom `sarvam-widget.js` injected into their Fern docs).

> **Provenance.** Every Sarvam claim below was read in `sarvam-convai-embed@1.0.19/index.js` (pinned;
> `unpkg.com/sarvam-convai-embed` without a version resolved to 1.0.19 on 2026-08-06) and line-cited
> against it. An earlier draft of this file carried four claims that were inferred rather than read;
> they were re-verified and corrected on 2026-08-06 and are called out inline where the distinction
> matters. Nothing in the task files depends on the corrected details — this file is comparison
> context only.

| | Sarvam Samvaad | BFG voice agent |
|---|---|---|
| Topology | one harness owns ASR + LLM + tools + TTS, self-hosted and co-located | **split**: `voice-agent/` (NestJS, Render) owns realtime audio; `/api/assistant/chat` (Vercel) owns the brain |
| Handshake | `GET /api/app-runtime/orgs/{org}/workspaces/{ws}/apps/{app}/url?interaction_type=call` + `X-API-Key` → `{signedUrl, referenceId}`. The WS URL is then augmented with **`interaction_type` only** (`augmentWsUrlWithParams`, `:35341`; the browser subclass hardcodes `"call"`, `:36212`) — sample rates never enter the URL | `POST /api/voice/token` → 60s one-use HS256 JWT → `wss://…/session?token=…` |
| Transport | 1 WebSocket, no WebRTC | 1 WebSocket, no WebRTC |
| Session open | after `server.action.interaction_connected`, the client sends **`client.action.interaction_start`** carrying `agent_variables`, `initial_language_name`, `initial_bot_message`, `initial_state_name` (`:34957`, sent at `:35700`) — this is the concrete "variables injectable from an on-start hook" mechanism | connection open **is** session start; no start frame (`voice-agent/src/common/protocol.ts:3`) |
| Uplink audio | AudioWorklet → Int16 LE PCM → base64 → JSON, 16 kHz, **30 ms** chunks (960 B). Frame is `{type, origin, timestamp, audio_base64, format: LINEAR16, sample_rate}` (`:36183`). Input `AudioContext` is left at the device rate and resampled in-SDK — a deliberate Firefox workaround (`:50-53`) | AudioWorklet → Int16 PCM → **binary frames**, 16 kHz, ~100 ms (`public/worklets/pcm-recorder.worklet.js`) |
| Downlink audio | base64 Int16 LE PCM, 22.05 kHz, on `server.media.audio_chunk` **only** (`server.media.audio` is in the enum but never handled). The decoder tolerates an optional **WAV header** — sniffs `RIFF`, walks chunks to `data` (`decodeInt16PCM`, `:37224`) | base64 **MP3**, 24 kHz, played through MediaSource (`src/lib/voice/audio-player.ts`) |
| Protocol shape | namespaced: `server.event.transcription`, `client.media.audio_chunk`, `server.action.interaction_connected`, … **but this SDK version routes only five types** — see the note below | flat: `transcript`, `audio`, `state`, `speak_delta`, … Two hand-mirrored copies (`voice-agent/src/common/protocol.ts` ↔ `src/lib/voice/protocol.ts`) |
| Turn-taking | server VAD + barge-in as a default layer | server VAD (Sarvam `high_vad_sensitivity`) **plus** client-side Silero VAD for instant local barge-in (`src/lib/voice/barge-in.ts`) |
| Default layers | pronunciation, mid-call language switch, voicemail, hold, long-silence wrap-up, background noise, barge-in | barge-in, silence re-prompt, session idle/max caps |
| Telemetry | **21 events**, incl. `signed_url_requested` / `_received` / `_failed`, `ws_connecting` / `ws_connected` / `ws_disconnected` / `ws_error`, `session_started` / `session_ended`, `interaction_connected`, `first_audio_packet_sent`, `first_audio_packet_received`, `state_changed`, `user_interrupted`, `user_muted` / `_unmuted`, `network_online` / `_offline`, `audio_interface_started` / `_stopped`, `error`. Plus `sessionEndInitiator` ∈ {`user` `:35201`, `network` `:35490`, `error` `:35586`, `agent` `:35810`} | JSON logs with `sessionId`/`mode`/`duration`; **latencies are free-text inside a log message** |

> **The namespaced vocabulary is larger than what the SDK consumes.** `routeMessage` (`:35713-35733`)
> dispatches only `server.media.text`, `server.event.transcription`, `server.action.interaction_end`,
> `server.system.ping` and `server.action.interaction_connected`. Everything else — including
> `user_speech_start`, `user_speech_end`, `user_interrupt`, `variable_update`, `language_change`,
> `state_transition`, `kb_query` and `tool_call` — falls through to `handleCustomMessage`, and
> `parseServerMessage` prints `[SDK] Unknown server message type` for anything outside a seven-case
> allowlist (`:34979-34994`). `server.media.text_chunk` is likewise validated but never separately
> dispatched. So the rich taxonomy is a *protocol* surface, not a client-observable event surface, in
> this version. Do not treat the enum as a list of things the client can react to.
>
> Symmetrically, `client.action.interaction_end` is defined (`:34813`) but has **zero** call sites —
> `stop()` sets `sessionEndInitiator` and simply calls `ws.close()` (`:35198-35212`). BFG does the same
> thing (`voice-agent/src/session/voice-session.ts:550`), so there is nothing to copy here.

## Navigation — the headline difference, and BFG wins

This is the capability the whole review was commissioned around ("I ask for a page, it takes me there").

**Sarvam's mechanism.** A turn's transcript text is the literal string `redirect::/some/path`. The
embed's `transcriptCallback` prefix-matches it and dispatches a DOM `CustomEvent("sarvam:redirect")`.
The host page then navigates with a three-tier fallback: `next.router.push(path)` → else
`querySelector` an existing `<a href>` matching the path (exact, then suffix, then contains) and
`.click()` it → else `pushState` + a synthetic `popstate`. Same-origin guarded. There is **no
validation of the path whatsoever** — the model can name any route and the client will attempt it.
They also monkey-patch `history.pushState`/`replaceState` to re-forward raw URL changes into the router.

> **Which wire the sentinel travels on — corrected 2026-08-06.** An earlier draft said the sentinel
> rides the agent's *response text* (`server.media.text`). It does not. `transcriptCallback` is fed
> **exclusively** by `ServerMsgType.TRANSCRIPTION` = `server.event.transcription`:
>
> ```js
> if (parsed.type === ServerMsgType.TEXT)               await this.handleText(parsed);
> else if (parsed.type === ServerMsgType.TRANSCRIPTION) await this.handleTranscript(parsed);
> ```
> (`routeMessage`, `:35717-35721`; `handleTranscript` → `transcriptCallback`, `:35730`)
>
> `server.media.text` goes to a *different* callback (`textCallback`) that the widget uses only for
> display. So the sentinel is on the **transcription/event** channel, while synthesis is driven from
> `server.media.audio_chunk` — a third channel again. Two consequences:
>
> 1. The concern flagged during the review — "does TTS read `redirect colon colon slash…` aloud?" — is
>    substantially weakened, because the sentinel never enters the media path. It is **not** proven
>    settled: no live call was placed, so this is an inference from routing, not an observation.
> 2. The sniffer is **role-blind.** The `Role` enum — `user` | `bot`, documented as "Role of the speaker
>    in a transcript" (`:34839-34844`) — means transcription events carry a speaker, and the check never
>    inspects it. A *user* utterance transcribed as `redirect::/…` would navigate.
>
> This matters for us only as a design lesson: if BFG ever adds a text-channel side band, put it on a
> channel the TTS layer cannot read, and check the speaker. BFG's current design sidesteps the whole
> question by carrying navigation as **structured data** on the NDJSON `result` event rather than as
> text — which is why none of the task files depend on this correction.

**BFG's mechanism.** A typed route manifest (`src/lib/assistant-route-manifest.ts`, 19 route ids) with
a per-route Zod param schema. Every model-proposed navigation goes through
`sanitizeAssistantNavigation` → `parseAssistantRouteNavigation`, which **reverse-parses the href back
into typed params, re-serializes it from the manifest, and byte-compares the result**
(`assistant-route-manifest.ts:824`). Alternate encodings, extra or duplicate query keys and stray
fragments are all rejected. Routes carry `auth`, `storeModes`, `entityResolution` and an `llmEnabled`
flag; the entity routes (`product_detail`, `order_detail`, `checkout_confirmation`) are
`llmEnabled: false` and resolved server-side from live, `is_active`-filtered data.

**Consequences for this plan:**

- **Do not port the three-tier fallback.** Manifest hrefs are locale-neutral and both consumers push
  through next-intl's locale-aware router (`storefront-assistant.tsx:36` + `:694`,
  `navigation-omnibox.tsx:28` + `:226`), so `/cart` becomes `/te/cart` automatically. The widget is
  mounted in `src/app/[locale]/layout.tsx:159`, so `router.push` is reliable. The `<a>`-click and
  `pushState` tiers would be dead code.
- **Do not weaken the byte-compare invariant.** T1-1 tightens a *value* schema inside it. Nothing else
  may relax it.
- The one real hole is that `category`, `material` and `tag` accept arbitrary text, so a navigation can
  be structurally perfect and still land on an empty grid. That is T1-1, and it is the most likely
  user-visible failure of the feature today.

## The structural cost of the split topology

Sarvam keeps the LLM inside the audio runtime. BFG puts the brain behind a second HTTP hop, so **the
brain's latency lands inside the audio turn budget** — `assistantResponseTimeoutMs` (30s server,
`voice-agent/src/common/config.ts:25`) and `ASSISTANT_CLIENT_TIMEOUT_MS` (28s,
`storefront-assistant.tsx:123`).

Every latency and stranded-state task below (T1-5, T1-9) is a consequence of that split. **The split
is still the right architecture** — it is what buys the validated navigation and lets voice reuse the
same grounded retrieval as typed chat. But it means the brain must be budgeted like a realtime
component, and today it is not: nothing in `/api/assistant/chat` knows it is inside a 30-second
audio turn.

## What is already good — treat as load-bearing, do not refactor

1. **Navigation validation** (above). The single best-engineered part of the stack.
2. **Client-side barge-in.** Silero VAD on the echo-cancelled mic stream, gated so it only acts while
   the assistant speaks (`barge-in.ts:36` uses `onSpeechRealStart`, not `onSpeechStart`, to avoid
   misfires). `echoCancellation: true` in `audio-capture.ts:14` is load-bearing for it — never remove.
3. **Generation counters.** `use-voice-session.ts` guards every async continuation on a `generation`
   counter and every audio/text frame on `utteranceId`. This is what makes barge-in safe. T1-7 fixes a
   gap in it; do not restructure it.
4. **Token handling.** The hand-rolled HS256 in `src/app/api/voice/token/route.ts:66-75` was
   round-tripped through the service's `jsonwebtoken` during review — all claims verify and `alg:none`
   is rejected by the algorithm allowlist. Skipping the JWT dependency was correct. Leave it alone.
5. **Zero-downtime secret rotation.** `VOICE_TOKEN_PREVIOUS_SECRET` fallback
   (`voice-agent/src/auth/session-token.ts:28-33`), production-validated and covered by
   `voice-agent/tests/protocol.test.ts:60`.
6. **Log hygiene.** `logEvent` accepts scalar fields only (`voice-agent/src/common/logger.ts:3-8`) and
   no call site passes tokens, transcripts or audio. **Do not "improve" logging by dumping `req.url`
   — it carries the token.**
7. **Speech text scrubbing.** `appendAssistantSpeech` (`voice-session.ts:420-430`) strips markdown,
   links and bracketed transliteration glosses from speech while keeping them on screen, with a Telugu
   regression test at `voice-session.test.ts:198-216`.
8. **Language agreement.** Both sides derive response language from the same
   `detectAssistantLanguage(transcript, locale)` call (`storefront-assistant.tsx:916,1220` and
   `route.ts:888`), so on-screen text and TTS voice cannot disagree. Do not replace this with a
   server-pushed language.
9. **Kill switch.** Removing `NEXT_PUBLIC_VOICE_WS_URL` removes both mic entry points and leaves typed
   Ask AI fully working.

## What NOT to copy from Sarvam

- The `redirect::` sentinel and its fallbacks — strictly worse than the manifest, dead code here.
  Sarvam sends navigation as an unvalidated string on a channel the SDK also uses for ASR output; BFG
  sends it as validated structured data on the `result` event. Keep BFG's.
- A namespaced protocol rewrite. Eight message types do not need namespacing — and Sarvam's own SDK
  routes only five of its ~20 namespaced types (see the note in §The two systems), so the taxonomy is
  aspirational there too. The real risk in the two hand-mirrored `protocol.ts` files is *drift*, and the
  cheap mitigation is a test asserting the two unions agree — not a redesign. (Not in this plan; note it
  as a candidate.)
- Voicemail detection, DTMF, artificial background noise, human handover. Telephony features. There is
  no telephony leg in BFG.
- 30 ms uplink chunks. Sarvam uses them (`inputChunkMs = 30`); BFG uses ~100 ms, which the build plan
  chose deliberately and flagged as unverified against Sarvam's guidance
  (`docs/voice-assistant-build-plan.md:503`). Smaller chunks cut a few ms of latency and cost ~3× the
  frame overhead. Not worth changing without measuring — and if you do measure it, that is a tuning
  experiment, not a robustness task.

## Genuine gap, deferred as a feature (not in this plan)

**Mid-call language switching.** Sarvam ships this as a default layer. In BFG the STT client is
constructed **once** with a fixed language code (`voice-session.ts:58`, from the `lang` query param at
`voice.gateway.ts:57-63`) while TTS language is chosen per utterance. So a customer who opens in Telugu
and switches to English keeps being transcribed as Telugu for the rest of the session. For a bilingual
store this matters. Implementing it means either connecting STT with `lang=unknown` (Sarvam's
auto-detect, already mapped at `voice.gateway.ts:59`) and trusting detection, or tearing down and
reopening the STT socket on a detected switch. Both are larger than anything in this plan and neither
is a *robustness* fix. Schedule separately after Tier 2.
