# T0-1 — Native apps declare no microphone permission

| | |
|---|---|
| **Severity** | critical |
| **Confidence** | `verified` |
| **Effort** | S (two config lines + `cap:sync`) |
| **Category** | robustness |
| **Files** | `android/app/src/main/AndroidManifest.xml`, `ios/App/App/Info.plist` |
| **Sequencing** | none. Do this first — it unblocks all native testing, including T1-11. |

## Symptom

Every voice session in the **Android and iOS apps** fails. The user taps the mic, no permission dialog
appears, and the panel immediately shows the "enable your microphone in Settings" explainer — pointing
at a Settings toggle that does not exist, because the app never requested the permission. Web works
perfectly, so browser QA never catches this.

## Verified root cause

`android/app/src/main/AndroidManifest.xml:73-74` declares only two permissions:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

There is no `android.permission.RECORD_AUDIO`.

`ios/App/App/Info.plist` contains **zero** occurrences of `NSMicrophoneUsageDescription` (verified with
`grep -c`, result `0`).

The app is not a separate bundle — `capacitor.config.ts:12` loads the live storefront:

```ts
url: devUrl || "https://bfg.darisi.in",
```

So the app renders exactly the same widget as the web, and the mic launcher appears whenever
`NEXT_PUBLIC_VOICE_WS_URL` is set. Capacitor's `BridgeWebChromeClient.onPermissionRequest` maps the
WebView's `AUDIO_CAPTURE` request onto `Manifest.permission.RECORD_AUDIO` and calls
`requestPermissions`. Android denies an **undeclared** permission immediately, with no dialog, so
`request.grant()` is never reached. `getUserMedia` therefore rejects with `NotAllowedError`, and
`src/hooks/use-voice-session.ts:217-219` maps that to:

```ts
if (error instanceof DOMException && error.name === "NotAllowedError") {
  teardown();
  setUiState("mic_denied");
}
```

On iOS, `WKWebView` media capture with no usage-description key is denied outright, and on some iOS
versions the missing key trips a TCC termination of the app process.

## The change

### Android

`android/app/src/main/AndroidManifest.xml` — add one line adjacent to the existing permissions:

```xml
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
+   <uses-permission android:name="android.permission.RECORD_AUDIO" />
```

Do **not** add `MODIFY_AUDIO_SETTINGS`, `BLUETOOTH_CONNECT`, or a `<uses-feature>` block. `RECORD_AUDIO`
is what the WebView permission bridge checks; anything more widens the Play Store permission disclosure
for no functional gain. Do **not** mark microphone as a required hardware feature — that would exclude
devices unnecessarily.

### iOS

`ios/App/App/Info.plist` — add one key inside the top-level `<dict>`:

```xml
+   <key>NSMicrophoneUsageDescription</key>
+   <string>Bhagyalakshmi Future Gold uses your microphone so you can talk to the shopping assistant.</string>
```

Write the string as customer-facing copy — Apple review rejects vague purpose strings. It appears
verbatim in the iOS permission dialog. Keep it in English; iOS localization of `Info.plist` strings
requires an `InfoPlist.strings` file per locale, which is out of scope here (note it as follow-up if
Telugu-language App Store presence matters).

### Then

```bash
npm run cap:sync
```

## Blast radius

Config only — no TypeScript, no runtime code. `use-voice-session.ts` already handles both the granted
and denied outcomes, and `mic_denied` copy already exists in `messages/en/voice.json` and
`messages/te/voice.json`. Nothing else consumes these two files for permissions.

## Acceptance criteria

1. On a real Android device running the app: tap the mic → **the system permission dialog appears** →
   grant → UI reaches `listening` → a spoken Telugu request produces a transcript and audible reply.
2. Deny at the dialog → the `mic_denied` explainer appears, and the Android app's Settings →
   Permissions page now shows a **Microphone** entry that can be toggled back on.
3. On a real iOS device: the permission dialog appears and shows the copy added above.
4. Web behaviour is unchanged.

## Verification

```bash
npm run cap:sync
# Android
npm run cap:android      # then run on a device from Android Studio
# iOS
npm run cap:ios          # then run on a device from Xcode
```

Confirm the merged manifest actually carries the permission:

```bash
grep -n "RECORD_AUDIO" android/app/src/main/AndroidManifest.xml
grep -n "NSMicrophoneUsageDescription" ios/App/App/Info.plist
```

## Rollback

Revert the two lines and `npm run cap:sync`. No data or state implications.

## Follow-up worth noting (do not do it in this task)

The native app has no way to *pre-explain* the microphone request before the OS dialog appears. That is
a UX polish item, not a robustness fix. Also unhandled: an incoming phone call during a voice session
(Android audio focus loss). That interacts with **T0-3** — verify the resume behaviour there once this
task makes native testing possible at all.
