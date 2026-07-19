"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startCapture, type Capture } from "@/lib/voice/audio-capture";
import { VoicePlayer } from "@/lib/voice/audio-player";
import { armBargeIn } from "@/lib/voice/barge-in";
import { parseServerMsg, type SessionState } from "@/lib/voice/protocol";

export type VoiceUiState =
  | "idle"
  | "connecting"
  | SessionState
  | "mic_denied"
  | "error";

type TurnCancellationReason = "barge_in" | "timeout" | "stopped";

interface UseVoiceSessionOptions {
  mode?: "conversation" | "assistant" | "transcribe";
  language?: "auto" | "en" | "te";
  onTranscript?: (text: string, utteranceId: number) => void;
  onTurnCancelled?: (utteranceId: number, reason: TurnCancellationReason) => void;
  stopAfterTranscript?: boolean;
}

const TOKEN_TIMEOUT_MS = 8_000;
const SOCKET_CONNECT_TIMEOUT_MS = 10_000;
const RECONNECT_DELAY_MS = 350;
const MAX_UPLINK_BUFFERED_BYTES = 256 * 1024;

export function useVoiceSession({
  mode = "conversation",
  language = "te",
  onTranscript,
  onTurnCancelled,
  stopAfterTranscript = false,
}: UseVoiceSessionOptions = {}) {
  const [uiState, setUiState] = useState<VoiceUiState>("idle");
  const [userText, setUserText] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const captureRef = useRef<Capture | null>(null);
  const playerRef = useRef<VoicePlayer | null>(null);
  const activeUtteranceRef = useRef(0);
  const playerUtteranceRef = useRef(-1);
  const serverStateRef = useRef<SessionState>("listening");
  const generationRef = useRef(0);
  const stoppingRef = useRef(false);
  const reconnectedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenAbortRef = useRef<AbortController | null>(null);
  const disarmVadRef = useRef<(() => void) | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onTurnCancelledRef = useRef(onTurnCancelled);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onTurnCancelledRef.current = onTurnCancelled;
  }, [onTurnCancelled]);

  const releaseResources = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
    tokenAbortRef.current?.abort();
    tokenAbortRef.current = null;
    disarmVadRef.current?.();
    disarmVadRef.current = null;
    captureRef.current?.stop();
    captureRef.current = null;
    playerRef.current?.stopAll();
    playerRef.current = null;
    playerUtteranceRef.current = -1;
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && ws.readyState < WebSocket.CLOSING) ws.close(1000, "client stopped");
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx && ctx.state !== "closed") void ctx.close();
  }, []);

  const teardown = useCallback(() => {
    generationRef.current += 1;
    stoppingRef.current = true;
    releaseResources();
  }, [releaseResources]);

  const stop = useCallback(() => {
    const id = activeUtteranceRef.current;
    if (serverStateRef.current === "thinking") {
      onTurnCancelledRef.current?.(id, "stopped");
    }
    teardown();
    setErrorCode(null);
    setUiState("idle");
  }, [teardown]);

  const fail = useCallback(
    (code: string, generation?: number) => {
      if (generation !== undefined && generation !== generationRef.current) return;
      if (serverStateRef.current === "thinking") {
        onTurnCancelledRef.current?.(activeUtteranceRef.current, "stopped");
      }
      teardown();
      setErrorCode(code);
      setUiState("error");
    },
    [teardown],
  );

  /** Mic mute: disabling the track silences BOTH consumers (STT uplink worklet
   *  and the local barge-in VAD) at the source; the frame gate in onFrame just
   *  saves the uplink bandwidth of silence. */
  const setMicMuted = useCallback((value: boolean) => {
    mutedRef.current = value;
    setMuted(value);
    const stream = captureRef.current?.stream;
    if (stream) {
      for (const track of stream.getAudioTracks()) track.enabled = !value;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMicMuted(!mutedRef.current);
  }, [setMicMuted]);

  /** Instant local stop, stale-chunk invalidation, then server cancellation. */
  const interrupt = useCallback(() => {
    const id = activeUtteranceRef.current;
    playerRef.current?.stopAll();
    playerUtteranceRef.current = -1;
    activeUtteranceRef.current = id + 1;
    onTurnCancelledRef.current?.(id, "barge_in");
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "interrupt", utteranceId: id }));
    }
    serverStateRef.current = "listening";
    setErrorCode(null);
    setUiState("listening");
  }, []);

  const start = useCallback(async () => {
    const base = process.env.NEXT_PUBLIC_VOICE_WS_URL;
    if (!base) {
      setErrorCode("not_configured");
      setUiState("error");
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setErrorCode("not_supported");
      setUiState("error");
      return;
    }

    let socketBase: URL;
    try {
      socketBase = new URL(base);
      if (socketBase.protocol !== "wss:" && socketBase.protocol !== "ws:") throw new Error();
      if (window.location.protocol === "https:" && socketBase.protocol !== "wss:") throw new Error();
    } catch {
      setErrorCode("not_configured");
      setUiState("error");
      return;
    }

    generationRef.current += 1;
    const generation = generationRef.current;
    stoppingRef.current = true;
    releaseResources();
    stoppingRef.current = false;
    reconnectedRef.current = false;
    activeUtteranceRef.current = 0;
    playerUtteranceRef.current = -1;
    serverStateRef.current = "listening";
    mutedRef.current = false;
    setMuted(false);
    setErrorCode(null);
    setUserText("");
    setAssistantText("");
    setUiState("connecting");

    const AudioContextConstructor = window.AudioContext;
    let ctx: AudioContext;
    try {
      ctx = new AudioContextConstructor();
      ctxRef.current = ctx;
      await ctx.resume();
    } catch {
      fail("audio_unavailable", generation);
      return;
    }
    if (generation !== generationRef.current) return;

    let capture: Capture;
    try {
      capture = await startCapture(ctx, (frame) => {
        if (mutedRef.current) return;
        const ws = wsRef.current;
        if (
          ws?.readyState === WebSocket.OPEN &&
          ws.bufferedAmount < MAX_UPLINK_BUFFERED_BYTES
        ) {
          ws.send(frame);
        }
      });
    } catch (error) {
      if (generation !== generationRef.current) return;
      console.warn("voice: mic capture failed:", error);
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        teardown();
        setUiState("mic_denied");
      } else if (error instanceof DOMException && error.name === "NotFoundError") {
        fail("no_mic", generation);
      } else {
        fail("audio_unavailable", generation);
      }
      return;
    }
    if (generation !== generationRef.current) {
      capture.stop();
      return;
    }
    captureRef.current = capture;

    const player = new VoicePlayer(() => {
      if (generation !== generationRef.current) return;
      if (serverStateRef.current === "listening") setUiState("listening");
    }, () => {
      if (generation !== generationRef.current) return;
      playerUtteranceRef.current = -1;
      setErrorCode("audio_playback_failed");
    });
    playerRef.current = player;

    if (mode !== "transcribe") {
      armBargeIn(capture.stream, ctx, () => {
        if (serverStateRef.current === "speaking" || player.playing) interrupt();
      })
        .then((disarm) => {
          if (generation !== generationRef.current || stoppingRef.current) disarm();
          else disarmVadRef.current = disarm;
        })
        .catch((error) => {
          console.warn("voice: local barge-in detection unavailable:", error);
        });
    }

    const openSocket = async (): Promise<void> => {
      if (generation !== generationRef.current || stoppingRef.current) return;
      const tokenAbort = new AbortController();
      tokenAbortRef.current = tokenAbort;
      const tokenTimer = setTimeout(() => tokenAbort.abort(), TOKEN_TIMEOUT_MS);
      let token: string;
      try {
        const response = await fetch("/api/voice/token", {
          method: "POST",
          cache: "no-store",
          signal: tokenAbort.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { token?: unknown };
        if (typeof body.token !== "string" || !body.token) throw new Error("invalid token");
        token = body.token;
      } finally {
        clearTimeout(tokenTimer);
        if (tokenAbortRef.current === tokenAbort) tokenAbortRef.current = null;
      }
      if (generation !== generationRef.current || stoppingRef.current) return;

      const socketUrl = new URL(socketBase);
      socketUrl.searchParams.set("token", token);
      if (mode !== "conversation") socketUrl.searchParams.set("mode", mode);
      socketUrl.searchParams.set("lang", language);
      const ws = new WebSocket(socketUrl);
      wsRef.current = ws;
      ws.binaryType = "arraybuffer";
      const connectTimer = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) ws.close(4000, "connect timeout");
      }, SOCKET_CONNECT_TIMEOUT_MS);

      ws.onopen = () => {
        clearTimeout(connectTimer);
        if (generation !== generationRef.current || stoppingRef.current) {
          ws.close(1000);
          return;
        }
        setErrorCode(null);
        serverStateRef.current = "listening";
        setUiState("listening");
      };
      ws.onerror = () => {
        // onclose owns retry/error state so the two events cannot race.
      };
      ws.onclose = (event) => {
        clearTimeout(connectTimer);
        if (wsRef.current === ws) wsRef.current = null;
        if (generation !== generationRef.current || stoppingRef.current) return;
        if (serverStateRef.current === "thinking") {
          onTurnCancelledRef.current?.(activeUtteranceRef.current, "stopped");
          activeUtteranceRef.current += 1;
        }
        player.stopAll();
        playerUtteranceRef.current = -1;
        serverStateRef.current = "listening";
        if (event.code === 4429) {
          fail("busy", generation);
        } else if (event.code === 4401 || event.code === 4403 || event.code === 4400) {
          fail("connection_rejected", generation);
        } else if (!reconnectedRef.current) {
          reconnectedRef.current = true;
          setUiState("connecting");
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            void openSocket().catch(() => fail("disconnected", generation));
          }, RECONNECT_DELAY_MS);
        } else {
          fail("disconnected", generation);
        }
      };

      ws.onmessage = (event) => {
        if (generation !== generationRef.current || typeof event.data !== "string") return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          fail("protocol_error", generation);
          return;
        }
        const msg = parseServerMsg(parsed);
        if (!msg) {
          fail("protocol_error", generation);
          return;
        }
        switch (msg.type) {
          case "state":
            serverStateRef.current = msg.value;
            if (msg.value === "listening" && player.playing) break;
            setUiState(msg.value);
            break;
          case "transcript":
            activeUtteranceRef.current = msg.utteranceId;
            setErrorCode(null);
            setUserText(msg.text);
            setAssistantText("");
            onTranscriptRef.current?.(msg.text, msg.utteranceId);
            if (stopAfterTranscript) stop();
            break;
          case "turn_cancelled":
            if (msg.utteranceId === activeUtteranceRef.current) {
              player.stopAll();
              playerUtteranceRef.current = -1;
              activeUtteranceRef.current = msg.utteranceId + 1;
              onTurnCancelledRef.current?.(msg.utteranceId, msg.reason);
            }
            break;
          case "assistant_text":
            if (msg.utteranceId >= activeUtteranceRef.current) {
              setAssistantText((previous) =>
                msg.utteranceId === activeUtteranceRef.current && previous
                  ? `${previous} ${msg.text}`
                  : msg.text,
              );
            }
            break;
          case "audio_reset":
            if (msg.utteranceId === activeUtteranceRef.current) {
              player.stopAll();
              playerUtteranceRef.current = -1;
              setAssistantText("");
            }
            break;
          case "audio": {
            if (msg.utteranceId < activeUtteranceRef.current) break;
            if (msg.utteranceId !== playerUtteranceRef.current) {
              playerUtteranceRef.current = msg.utteranceId;
              player.beginUtterance(ctx);
            }
            try {
              const binary = atob(msg.data);
              const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
              player.pushChunk(bytes);
            } catch {
              fail("protocol_error", generation);
            }
            break;
          }
          case "utterance_end":
            if (msg.utteranceId === playerUtteranceRef.current) player.endUtterance();
            break;
          case "error":
            if (msg.code === "session_idle" || msg.code === "session_max") {
              stop();
            } else if (msg.recoverable || msg.code === "tts_failed") {
              setErrorCode(msg.code);
            } else {
              fail(msg.code, generation);
            }
            break;
        }
      };
    };

    try {
      await openSocket();
    } catch (error) {
      if (generation !== generationRef.current || stoppingRef.current) return;
      const code = error instanceof DOMException && error.name === "AbortError"
        ? "token_timeout"
        : "token_failed";
      fail(code, generation);
    }
  }, [fail, interrupt, language, mode, releaseResources, stop, stopAfterTranscript, teardown]);

  const speak = useCallback((text: string, utteranceId: number, responseLanguage?: "en" | "te") => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: "speak", utteranceId, text, language: responseLanguage }));
    return true;
  }, []);

  const startSpeaking = useCallback((utteranceId: number, responseLanguage?: "en" | "te") => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: "speak_start", utteranceId, language: responseLanguage }));
    return true;
  }, []);

  const appendSpeech = useCallback((text: string, utteranceId: number) => {
    const ws = wsRef.current;
    const boundedText = text.trim().slice(0, 1000);
    if (ws?.readyState !== WebSocket.OPEN || !boundedText) return false;
    ws.send(JSON.stringify({ type: "speak_delta", utteranceId, text: boundedText }));
    return true;
  }, []);

  const finishSpeaking = useCallback((utteranceId: number) => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: "speak_end", utteranceId }));
    return true;
  }, []);

  const resetSpeaking = useCallback((utteranceId: number) => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: "speak_reset", utteranceId }));
    return true;
  }, []);

  useEffect(() => teardown, [teardown]);

  return {
    uiState,
    userText,
    assistantText,
    errorCode,
    muted,
    toggleMute,
    start,
    stop,
    interrupt,
    speak,
    startSpeaking,
    appendSpeech,
    finishSpeaking,
    resetSpeaking,
  };
}
