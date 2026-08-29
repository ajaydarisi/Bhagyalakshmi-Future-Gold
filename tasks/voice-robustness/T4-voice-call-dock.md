# T4 — Bring the voice agent out of the sidebar: a floating call dock

| | |
|---|---|
| **Severity** | high (fixes a verified control-less state) |
| **Confidence** | `verified` |
| **Effort** | M |
| **Category** | ux |
| **Files** | `src/components/assistant/voice-call-dock.tsx` (new), `storefront-assistant.tsx`, `messages/{en,te}/voice.json` |
| **Decided** | Floating call dock; the Ask AI sidebar no longer opens when a call starts |

## The bug this fixes

The mic already sits outside the sidebar — the FAB is a split pill,
`[Sparkles Ask AI][🎤]` (`storefront-assistant.tsx:1328-1376`). But:

1. `handleVoiceToggle` calls `setOpen(true)`, so starting a call force-opens the right-hand `Sheet`
   (`side="right"`, `h-[100dvh]`, full-width under `sm:`). The page is covered for the whole call.
2. **Every** live voice control renders *inside* that Sheet — the state label, the transcript, the
   `liveHint`, mute, interrupt, and the Retry button added in T1-6 (`:1638-1730`).
3. `navigateAssistantNavigation` calls `setOpen(false)` and then `router.push`, deliberately **not**
   `handleOpenChange(false)`, because that would stop the session — the comment at `:691-692` says the
   spoken acknowledgement must keep playing.

Compose those and you get the failure: **a voice navigation closes the sheet, the assistant keeps
talking, and the customer has no visible voice UI and no way to interrupt.** The only remaining control
is the FAB mic, which stops the whole session rather than the current utterance. This is precisely the
"take me to that page" flow the feature exists for, so it fires on the happy path, not an edge case.

## Design

A compact dock anchored directly above the FAB, in the same fixed container, visible whenever a session
is live **and** the sheet is closed. The page stays fully browsable, so a spoken "గాజుల పేజీకి
తీసుకెళ్తున్నాను" plays while the customer watches the filtered page arrive.

```
┌─ page content stays visible ──────────┐
│  /products?category=bangles           │
│  [product] [product] [product]        │
│              ┌──────────────────────┐ │
│              │ 🎤 Voice Assistant ✕ │ │
│              │ ● Speaking           │ │
│              │ "గాజుల పేజీకి…"       │ │
│              │ [Mute] [Interrupt]   │ │
│              │ View conversation →  │ │
│              └──────────────────────┘ │
│                     ( Ask AI )( 🎤 )  │
└───────────────────────────────────────┘
```

Rules:

- **Dock is the live surface.** `handleVoiceToggle` stops calling `setOpen(true)`.
- **Dock hides while the sheet is open** (`!open`). The in-sheet block stays exactly as it is, so there
  is never a moment with two sets of controls, no z-index fight with the Sheet overlay, and the existing
  e2e tests — which open the sheet via the Ask AI launcher and then drive the in-sheet mic — keep
  passing untouched.
- **"View conversation" opens the sheet**, so product cards, images and citations attached by the
  terminal `result` event stay reachable. Shown only when the conversation has entries.
- **Dismiss (✕) closes the dock without ending the call.** Reopens automatically on the next state
  change so the customer cannot lose the interrupt control permanently.

## Why not the alternatives

- **Bottom bar:** collides with the existing mobile bottom-nav (`components/layout/bottom-nav`) and the
  product detail action bar, and costs scarce vertical space on the phones most customers use.
- **Full-screen overlay:** hides the page, which defeats navigation — the customer cannot see the page
  they were just taken to. Wrong for this product even though it is the most conventional "call" UI.

## Implementation

### 1. New presentational component

`src/components/assistant/voice-call-dock.tsx`. Props only — no hooks, no session ownership. The session
stays in `storefront-assistant.tsx`, which already owns `useVoiceSession`.

```ts
interface VoiceCallDockProps {
  state: VoiceUiState;           // from @/hooks/use-voice-session
  errorMessage: string | null;   // caller passes getVoiceErrorMessage() when relevant
  userText: string;
  assistantText: string;
  muted: boolean;
  canViewConversation: boolean;
  onToggleMute(): void;
  onInterrupt(): void;
  onStop(): void;
  onRetry(): void;
  onViewConversation(): void;
  onDismiss(): void;
}
```

Reuse the in-sheet block's semantics verbatim: `role="alert"` in the error states and `role="status"`
otherwise, the same state→label mapping, the same `liveHint`/`mutedHint` rules, mute+interrupt only
while live, Retry only in `error`/`mic_denied`.

### 2. Wire it in `storefront-assistant.tsx`

- Remove `setOpen(true)` from `handleVoiceToggle`.
- Add `const [dockDismissed, setDockDismissed] = useState(false)`; reset it in `startVoice` and on every
  `voiceState` change so a dismissal never outlives the current state.
- Render inside the existing fixed FAB container, above the pill, when
  `showVoiceActivity && !open && !dockDismissed`.
- `onViewConversation` → `setOpen(true)` (plain, not `handleOpenChange`, which is fine for opening).
- `onStop` → `stopVoice`.

### 3. Copy

Two new keys in **both** `messages/en/voice.json` and `messages/te/voice.json` — a missing `te` key
breaks the Telugu locale:

| Key | en | te |
|---|---|---|
| `viewConversation` | View conversation | సంభాషణ చూడండి |
| `dismiss` | Hide | దాచండి |

Everything else reuses existing keys (`title`, `connecting`, `listening`, `thinking`, `speaking`,
`liveHint`, `mutedHint`, `mute`, `unmute`, `interrupt`, `stop`, `retry`).

### 4. Layout constraints

- Container is `fixed bottom-24 right-4 z-40 lg:bottom-6 lg:right-6` — mobile bottom offset already
  clears the bottom-nav, so the dock inherits correct placement for free.
- `w-[min(20rem,calc(100vw-2rem))]` so it never overflows a small viewport.
- Transcript lines clamped (`line-clamp-2` user, `line-clamp-3` assistant) so a long reply cannot grow
  the dock without bound.
- The FAB's pulse ring is `absolute inset-0` inside that container; the dock must be a sibling in normal
  flow above the pill, not inside the ring's box.

## Follow-up: the two remaining links (found in use, 2026-08-06)

The first pass removed `setOpen(true)` from `handleVoiceToggle`, but a spoken turn still opened the
sidebar. Two more couplings existed:

1. **`sendMessage` opened the sheet unconditionally** (`storefront-assistant.tsx:855`). The voice
   transcript path runs through `sendMessage(transcript, "voice", …)`, so the sheet opened the moment
   speech was recognized — the reported "I speak, it opens the sidebar, thinks, then navigates".
   Now gated on `source === "text"`, which also stops a voice turn from clearing a half-typed composer
   message.
2. **`handleOpenChange(false)` called `stopVoice()`** (`:1225`), so closing the sidebar ended a live
   call. That made sense when the sheet was the only voice surface; with the dock it is wrong. Closing
   now hands the call to the dock, which carries its own Stop. Pending spoken disambiguation options are
   also preserved while a call is live, because the customer answers those by voice ("the first one")
   with the sheet shut.

**Complete enumeration of sheet-open paths after the change** — the sheet can now only open from an
explicit user action:

| Line | Call | Trigger |
|---|---|---|
| `:860` | `setOpen(true)` | `sendMessage`, **text turns only** |
| `:1231` | `setOpen(nextOpen)` | `handleOpenChange` — Ask AI launcher and the Sheet's own `onOpenChange` |
| `:1369` | `setOpen(true)` | the dock's "View conversation" |

No voice path opens it. `setOpen(false)` at `:715` / `:1328` / `:1341` (navigate, citation, product
click) only ever closes.

## Acceptance criteria

1. Tapping the FAB mic starts a call and shows the dock. **The sidebar does not open.**
2. Asking "take me to gold bangles" by voice navigates, and the dock **remains visible** with a working
   Interrupt while the acknowledgement is still speaking. (Before: no controls at all.)
3. Interrupt in the dock stops speech and returns to Listening without ending the session.
4. Stop in the dock ends the session and the dock disappears.
5. Opening Ask AI hides the dock; closing it brings the dock back if the session is still live.
6. An error state shows the message plus a working Retry in the dock.
7. Both locales render, including the two new keys.
8. Existing e2e voice tests pass unchanged.

## Verification

```bash
npm run lint && npx tsc --noEmit && npm run test:unit && npm run build
npx playwright test tests/e2e/assistant.spec.ts --project=chromium
```

Then in the browser, with both services running: start a call from the FAB, ask for a page by voice, and
confirm the dock survives the navigation with a live Interrupt.
