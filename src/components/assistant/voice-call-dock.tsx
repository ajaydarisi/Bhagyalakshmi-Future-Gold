"use client";

import { ChevronRight, Loader2, Mic, MicOff, Square, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { VoiceUiState } from "@/hooks/use-voice-session";
import { cn } from "@/lib/utils";

interface VoiceCallDockProps {
  state: VoiceUiState;
  /** Already-localized message; caller owns the code→copy mapping. */
  errorMessage: string | null;
  userText: string;
  assistantText: string;
  muted: boolean;
  /** Only offer the sidebar link when there is something to read there. */
  canViewConversation: boolean;
  onToggleMute: () => void;
  onInterrupt: () => void;
  onStop: () => void;
  onRetry: () => void;
  onViewConversation: () => void;
  onDismiss: () => void;
}

/**
 * Live voice surface, rendered outside the Ask AI sheet so the page stays
 * visible and browsable during a call.
 *
 * This exists because every voice control used to live inside the sheet, while
 * a voice navigation deliberately closes the sheet and keeps the session alive
 * so the spoken acknowledgement finishes — leaving the customer with audio
 * playing and no way to interrupt it. The dock is what they interrupt with.
 *
 * Presentational only: the session stays owned by StorefrontAssistant.
 */
export function VoiceCallDock({
  state,
  errorMessage,
  userText,
  assistantText,
  muted,
  canViewConversation,
  onToggleMute,
  onInterrupt,
  onStop,
  onRetry,
  onViewConversation,
  onDismiss,
}: VoiceCallDockProps) {
  const t = useTranslations("voice");

  const isLive =
    state === "listening" || state === "thinking" || state === "speaking";
  const isFailed = state === "error" || state === "mic_denied";
  // Mirrors the in-sheet block: a recoverable error can arrive while the session
  // is still live, so failure styling keys off the message too.
  const showsProblem = isFailed || Boolean(errorMessage);

  const statusLabel =
    state === "connecting"
      ? t("connecting")
      : state === "listening"
        ? t("listening")
        : state === "thinking"
          ? t("thinking")
          : state === "speaking"
            ? t("speaking")
            : null;

  return (
    <div
      role={showsProblem ? "alert" : "status"}
      aria-live={showsProblem ? "assertive" : "polite"}
      data-testid="voice-call-dock"
      className={cn(
        "mb-3 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2",
        showsProblem && "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          {state === "connecting" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Mic
              className={cn(
                "size-4",
                state === "speaking" && "motion-safe:animate-pulse",
              )}
            />
          )}
          {t("title")}
        </span>
        <div className="flex items-center gap-1">
          {statusLabel && (
            <span className="text-xs text-muted-foreground">{statusLabel}</span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("dismiss")}
            className="size-7"
            onClick={onDismiss}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {userText && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {userText}
        </p>
      )}

      {assistantText && (
        <p className="mt-1 line-clamp-3 text-sm" data-testid="voice-dock-answer">
          {assistantText}
        </p>
      )}

      {state === "listening" && !muted && !assistantText && (
        <p className="mt-2 text-xs text-muted-foreground">{t("liveHint")}</p>
      )}

      {muted && (
        <p className="mt-2 text-xs text-muted-foreground">{t("mutedHint")}</p>
      )}

      {showsProblem && errorMessage && (
        <p className="mt-2 text-sm text-destructive">{errorMessage}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isLive && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={muted}
              onClick={onToggleMute}
            >
              {muted ? <Mic className="size-3" /> : <MicOff className="size-3" />}
              {muted ? t("unmute") : t("mute")}
            </Button>
            {state === "speaking" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onInterrupt}
              >
                <Square className="size-3" />
                {t("interrupt")}
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={onStop}>
              {t("stop")}
            </Button>
          </>
        )}

        {isFailed && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <Mic className="size-3" />
            {t("retry")}
          </Button>
        )}

        {canViewConversation && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={onViewConversation}
          >
            {t("viewConversation")}
            <ChevronRight className="size-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
