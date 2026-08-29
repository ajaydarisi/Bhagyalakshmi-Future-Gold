// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceCallDock } from "@/components/assistant/voice-call-dock";
import type { VoiceUiState } from "@/hooks/use-voice-session";
import voiceMessages from "@/../messages/en/voice.json";

/**
 * The dock is the ONLY voice surface once a call is live, because starting a call
 * no longer opens the Ask AI sheet and a voice navigation closes it. So the
 * controls it offers per state are load-bearing: before this component existed, a
 * navigation left the customer with audio playing and no way to interrupt.
 */
// vitest `globals` is off, so testing-library's auto-cleanup never registers and
// renders would otherwise accumulate across tests in this file.
afterEach(cleanup);

function renderDock(overrides: Partial<Parameters<typeof VoiceCallDock>[0]> = {}) {
  const handlers = {
    onToggleMute: vi.fn(),
    onInterrupt: vi.fn(),
    onStop: vi.fn(),
    onRetry: vi.fn(),
    onViewConversation: vi.fn(),
    onDismiss: vi.fn(),
  };
  render(
    <NextIntlClientProvider locale="en" messages={{ voice: voiceMessages }}>
      <VoiceCallDock
        state="listening"
        errorMessage={null}
        userText=""
        assistantText=""
        muted={false}
        canViewConversation={false}
        {...handlers}
        {...overrides}
      />
    </NextIntlClientProvider>,
  );
  return handlers;
}

describe("VoiceCallDock", () => {
  it("offers Interrupt while speaking — the control a navigation used to strand", () => {
    renderDock({ state: "speaking", assistantText: "Taking you to bangles." });
    expect(screen.getByRole("button", { name: /interrupt/i })).toBeTruthy();
    expect(screen.getByText("Taking you to bangles.")).toBeTruthy();
    expect(screen.getByText("Speaking…")).toBeTruthy();
  });

  it("does not offer Interrupt when there is nothing being spoken", () => {
    renderDock({ state: "listening" });
    expect(screen.queryByRole("button", { name: /interrupt/i })).toBeNull();
    // Mute and Stop stay available for the whole live session.
    expect(screen.getByRole("button", { name: "Mute mic" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
  });

  it("surfaces a failure as an alert with a working retry", () => {
    const handlers = renderDock({
      state: "mic_denied",
      errorMessage: "Microphone access was denied.",
    });
    const dock = screen.getByTestId("voice-call-dock");
    expect(dock.getAttribute("role")).toBe("alert");
    expect(screen.getByText("Microphone access was denied.")).toBeTruthy();
    screen.getByRole("button", { name: /try again/i }).click();
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
    // A failed session has no live controls to offer.
    expect(screen.queryByRole("button", { name: /interrupt/i })).toBeNull();
  });

  it("treats a recoverable error during a live session as a problem too", () => {
    // tts_failed arrives while the session keeps running, so the dock must show
    // the message without losing the live controls.
    renderDock({ state: "speaking", errorMessage: "Audio is unavailable." });
    const dock = screen.getByTestId("voice-call-dock");
    expect(dock.getAttribute("role")).toBe("alert");
    expect(screen.getByRole("button", { name: /interrupt/i })).toBeTruthy();
  });

  it("is a status region, not an alert, during a normal turn", () => {
    renderDock({ state: "listening" });
    expect(screen.getByTestId("voice-call-dock").getAttribute("role")).toBe("status");
  });

  it("links to the sidebar only when there is a conversation to read", () => {
    const handlers = renderDock({ canViewConversation: true });
    screen.getByRole("button", { name: /view conversation/i }).click();
    expect(handlers.onViewConversation).toHaveBeenCalledTimes(1);

    screen.getByRole("button", { name: "Hide" }).click();
    expect(handlers.onDismiss).toHaveBeenCalledTimes(1);
  });

  it("hides the sidebar link when the conversation is empty", () => {
    renderDock({ canViewConversation: false });
    expect(screen.queryByRole("button", { name: /view conversation/i })).toBeNull();
  });

  it("prefers the muted hint over the live hint", () => {
    renderDock({ state: "listening", muted: true });
    expect(screen.getByText(/mic is muted/i)).toBeTruthy();
    expect(screen.queryByText(/ask a follow-up anytime/i)).toBeNull();
  });

  it("renders every state without throwing", () => {
    const states: VoiceUiState[] = [
      "idle",
      "connecting",
      "listening",
      "thinking",
      "speaking",
      "mic_denied",
      "error",
    ];
    for (const state of states) {
      expect(() => renderDock({ state })).not.toThrow();
      cleanup();
    }
  });
});
