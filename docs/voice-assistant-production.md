# Voice Shopping Assistant: Production Guide

## What ships

The microphone is part of the existing Shopping Assistant, not a separate speech-to-text widget. A voice turn follows this path:

1. The browser streams 16 kHz PCM audio to the voice service.
2. Sarvam STT returns finalized fragments.
3. The service waits for a 1.4 second quiet window before emitting one complete turn.
4. The storefront runs the same grounded catalog retrieval used by typed Ask AI messages.
5. Gemini's structured answer streams through `/api/assistant/chat` as bounded NDJSON answer deltas. The UI renders those deltas immediately with the AI message renderer.
6. Completed sentences are forwarded over the existing voice WebSocket and synthesized immediately on one persistent Sarvam TTS socket; generation does not need to finish before speech starts.
7. The terminal stream event attaches the validated product cards, product images, citations, follow-up suggestions, and handoff without replacing the live answer.

If the customer resumes speaking while the storefront is thinking, the pending request is aborted and its transcript is combined with the continuation. If the customer speaks over audio playback, the old audio and response are cancelled immediately.

The turn gate is intentional: a finalized STT fragment does not immediately start retrieval. A later `START_SPEECH` event or transcript fragment cancels the settle timer (or an already-started request), preserves the earlier words, and restarts the quiet window. This is what prevents a short natural pause from sending a half-spoken message.

## Streaming contracts

The storefront requests `Accept: application/x-ndjson` from `POST /api/assistant/chat`. The response event vocabulary is:

| Event | Purpose |
| --- | --- |
| `start` | Confirms the response stream is open. |
| `answer_delta` | Appends validated, citation-grounded answer text. |
| `answer_reset` | Clears a draft if structured generation retries or revises its prefix. |
| `result` | Supplies the final `reply`, including products/images/citations, and optional handoff. |
| `error` | Carries a typed application error and status after streaming headers were sent. |

Callers that do not request NDJSON continue to receive the legacy JSON response. Streaming responses set `Cache-Control: no-store, no-transform` and `X-Accel-Buffering: no`; production proxies must preserve chunked delivery and must not buffer or compress the entire response before forwarding it.

For grounded voice turns, the browser-to-voice-service control vocabulary is `speak_start`, zero or more bounded `speak_delta` sentence chunks, optional `speak_reset`, and `speak_end`. `speak_delta` starts TTS immediately. `speak_end` only flushes the existing TTS stream. On reset, the service closes draft TTS and emits `audio_reset`, which clears already-buffered browser audio without cancelling the replacement answer. The legacy one-shot `speak` control remains accepted during a rolling deployment.

## Runtime topology

- **Next.js storefront:** serves the assistant UI, `/api/assistant/chat`, `/api/voice/token`, and self-hosted VAD assets under `/vad/`.
- **Voice service:** the container in `voice-agent/`; accepts long-lived WebSockets at `/session` and exposes `/healthz` and `/readyz`.
- **External providers:** Sarvam STT/TTS and Gemini for grounded answer generation. Conversation-only voice mode can also use Gemini or Sarvam as configured.

The voice service must run on infrastructure that supports long-lived WebSockets. Put it behind TLS and expose it as `wss://.../session`. Configure the load balancer idle timeout above the service heartbeat interval and session idle limit.

## Required configuration

Use Node.js 22 for both applications.

Storefront:

| Variable | Requirement |
| --- | --- |
| `NEXT_PUBLIC_VOICE_WS_URL` | Public `wss://` voice endpoint. Omitting it safely hides all microphone controls. |
| `VOICE_TOKEN_SECRET` | Same random secret as the voice service; at least 32 characters. Never prefix it with `NEXT_PUBLIC_`. |
| `GEMINI_API_KEY` | Required for grounded generation and embeddings. |
| `AI_HTTP_TIMEOUT_MS` | Optional, clamped to 5–30 seconds; default 12 seconds. |

Voice service variables are documented in [`voice-agent/.env.example`](../voice-agent/.env.example). Production requires at minimum `SARVAM_API_KEY`, `VOICE_TOKEN_SECRET`, and exact comma-separated `ALLOWED_ORIGINS`. Set `GEMINI_API_KEY` when `LLM_PROVIDER=gemini` or when conversation mode is enabled.

Use a generated secret, for example:

```bash
openssl rand -base64 48
```

Do not log tokens, API keys, raw audio, or transcript contents. Application logs intentionally contain session IDs, modes, state events, durations, and error categories only.

## Build and deploy

Storefront:

```bash
npm ci
npm run build
npm run start
```

`postinstall` copies the minimum VAD runtime into `public/vad/`; these generated files are intentionally ignored by Git.

Voice service container:

```bash
docker build -t bfg-voice-agent ./voice-agent
docker run --rm -p 8080:8080 --env-file voice-agent/.env bfg-voice-agent
```

Deployment order:

1. Deploy the voice service with the production secrets and exact storefront origins.
2. Confirm `/readyz` returns `200` and includes available capacity.
3. Confirm the TLS WebSocket endpoint accepts a token minted by the production storefront.
4. Add `NEXT_PUBLIC_VOICE_WS_URL` to the storefront and deploy it.
5. Run the smoke checks below in English and Telugu on desktop Chrome and one mobile device.

The session token is a 60-second, HS256, one-use JWT scoped to issuer `bfg-storefront` and audience `bfg-voice-agent`. The voice service rejects foreign origins, replayed tokens, malformed controls, oversized frames, and sessions above configured capacity.

## Edge and capacity controls

The application includes instance-local safeguards, but production edge limits are still required because serverless instances do not share memory:

- Limit `POST /api/voice/token` to 10 requests per minute per client IP.
- Limit `POST /api/assistant/chat` to 12 requests per minute per client IP.
- Reject request bodies above the platform limits before invoking the application.
- Disable response buffering for `application/x-ndjson` and keep the route's `no-transform` and `X-Accel-Buffering: no` headers intact.
- Restrict the voice service to the documented WebSocket path and health endpoints.
- Start with `MAX_CONCURRENT_SESSIONS=8` per voice container, then load-test before raising it.

Autoscaling must account for long-lived sessions. Drain old containers during deployment so active sockets can finish; the browser performs one bounded reconnect for unexpected disconnects.

## Verification

Run before release:

```bash
npm run lint
npx tsc --noEmit
npm run test:unit
npm run build
npx playwright test tests/e2e/assistant.spec.ts --project=chromium

cd voice-agent
npm test
npm run typecheck
npm run build
npm audit --omit=dev
```

Smoke test:

- Open Ask AI and start voice; the UI must show Connecting, then Listening.
- Speak a product request with a short pause in the middle; no message should be sent during that pause.
- Finish speaking; one combined user message should appear after the quiet window.
- Confirm answer text grows while the request is still active and first audio begins after the first complete sentence, before product cards are attached.
- Confirm the answer contains relevant product cards, loaded images, and clickable citations.
- Speak while the answer is being read; playback must stop and Listening must resume.
- Continue speaking while the assistant is Thinking; the stale request must disappear and be replaced by the combined turn.
- Deny microphone permission and verify the localized recovery message.

## Monitoring and alerts

The voice service writes JSON logs with `event`, `sessionId`, `mode`, duration/capacity fields, and categorized activity messages. Collect these logs and dashboard at least:

- active sessions versus `maxSessions`;
- connection rejections grouped by reason;
- STT, TTS, assistant timeout, backpressure, and heartbeat failures;
- first-sentence and first-audio latency;
- assistant time-to-first-delta and time from first delta to first TTS sentence;
- session duration and unexpected disconnect rate;
- frontend `assistant_voice_start`, `assistant_voice_transcript`, and `assistant_voice_error` analytics events.

Suggested initial alerts:

- `/readyz` fails twice in two minutes;
- error or unexpected disconnect rate exceeds 5% for five minutes;
- `at_capacity` rejections occur for three consecutive minutes;
- p95 first-audio latency exceeds 6 seconds for ten minutes;
- assistant timeout rate exceeds 2% for ten minutes.

## Incident response and rollback

1. Check `/readyz`, active capacity, and categorized service logs.
2. If one provider is failing, preserve the text Shopping Assistant and disable voice by removing `NEXT_PUBLIC_VOICE_WS_URL` from the storefront deployment.
3. If only TTS fails, the grounded answer remains visible; investigate `tts_failed` and `audio_playback_failed` without disabling typed chat.
4. Roll back the voice container independently when the protocol is unchanged.
5. For a zero-downtime secret rotation, deploy the voice service with the new `VOICE_TOKEN_SECRET` and the old value in `VOICE_TOKEN_PREVIOUS_SECRET`, update the storefront to sign with the new secret, then remove the previous secret after all storefront instances have converged. Existing sockets continue throughout.

Removing `NEXT_PUBLIC_VOICE_WS_URL` is the feature kill switch. It removes both microphone entry points while leaving typed Ask AI, retrieval, images, and citations available.
