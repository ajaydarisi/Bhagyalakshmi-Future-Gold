// WS entry point. Token + origin are checked HERE, in handleConnection —
// Nest guards do not reliably run on the WebSocket upgrade.
// ponytail: session registry is a Map in this class; a separate manager file
// adds nothing at this size.
import type { IncomingMessage } from "node:http";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from "@nestjs/websockets";
import type WebSocket from "ws";
import { verifySessionToken } from "../auth/session-token.js";
import { CONFIG } from "../common/config.js";
import { logEvent, type LogLevel } from "../common/logger.js";
import { parseClientMsg } from "../common/protocol.js";
import {
  VoiceSession,
  type VoiceLanguageCode,
  type VoiceSessionMode,
} from "../session/voice-session.js";

@WebSocketGateway({
  path: "/session",
  maxPayload: 64 * 1024,
  perMessageDeflate: false,
})
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly sessions = new Map<WebSocket, VoiceSession>();
  private readonly sessionMetadata = new Map<
    WebSocket,
    { id: number; mode: VoiceSessionMode; startedAt: number }
  >();
  private readonly heartbeatTimers = new Map<WebSocket, NodeJS.Timeout>();
  private readonly usedTokenIds = new Map<string, number>();
  private nextId = 1;

  handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const origin = req.headers.origin;
    if (
      CONFIG.allowedOrigins.length > 0 &&
      (!origin || !CONFIG.allowedOrigins.includes(origin))
    ) {
      logEvent("warn", "gateway_connection_rejected", {
        reason: "origin_not_allowed",
        origin: origin ?? "none",
      });
      ws.close(4403, "origin not allowed");
      return;
    }
    const url = new URL(req.url ?? "/", "http://x");
    const token = url.searchParams.get("token") ?? "";
    const requestedMode = url.searchParams.get("mode");
    const mode: VoiceSessionMode =
      requestedMode === "assistant" || requestedMode === "transcribe"
        ? requestedMode
        : "conversation";
    const requestedLanguage = url.searchParams.get("lang");
    const languageCode: VoiceLanguageCode =
      requestedLanguage === "auto"
        ? "unknown"
        : requestedLanguage === "en"
          ? "en-IN"
          : "te-IN";
    const claims = verifySessionToken(token);
    if (!claims || this.isReplayedToken(claims.jti, claims.exp)) {
      logEvent("warn", "gateway_connection_rejected", {
        reason: "invalid_or_replayed_token",
        origin: origin ?? "none",
      });
      ws.close(4401, "invalid token");
      return;
    }
    if (this.sessions.size >= CONFIG.maxSessions) {
      logEvent("warn", "gateway_connection_rejected", {
        reason: "at_capacity",
        activeSessions: this.sessions.size,
        maxSessions: CONFIG.maxSessions,
      });
      ws.send(JSON.stringify({ type: "error", code: "busy", message: "assistant is busy" }));
      ws.close(4429, "busy");
      return;
    }

    const id = this.nextId++;
    const log = (message: string) => {
      const level: LogLevel = /error|fatal|failed|timeout|backpressure|closing/i.test(message)
        ? "warn"
        : "info";
      logEvent(level, "session_activity", { sessionId: id, mode, message });
    };
    const session = new VoiceSession(ws, log, mode, languageCode);
    this.sessions.set(ws, session);
    this.sessionMetadata.set(ws, { id, mode, startedAt: Date.now() });
    logEvent("info", "session_connected", {
      sessionId: id,
      mode,
      languageCode,
      activeSessions: this.sessions.size,
      maxSessions: CONFIG.maxSessions,
    });
    this.armHeartbeat(ws);

    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        const frame = data as Buffer;
        if (frame.byteLength > CONFIG.maxAudioFrameBytes) {
          log(`closing: oversized audio frame (${frame.byteLength} bytes)`);
          ws.close(4400, "audio frame too large");
          return;
        }
        session.onAudio(frame);
      } else {
        try {
          const message = parseClientMsg(JSON.parse(data.toString()));
          if (!message) {
            ws.close(4400, "invalid control message");
            return;
          }
          session.onControl(message);
        } catch {
          ws.close(4400, "invalid control message");
        }
      }
    });
  }

  handleDisconnect(ws: WebSocket): void {
    const metadata = this.sessionMetadata.get(ws);
    const heartbeat = this.heartbeatTimers.get(ws);
    if (heartbeat) clearInterval(heartbeat);
    this.heartbeatTimers.delete(ws);
    this.sessions.get(ws)?.destroy();
    this.sessions.delete(ws);
    this.sessionMetadata.delete(ws);
    if (metadata) {
      logEvent("info", "session_disconnected", {
        sessionId: metadata.id,
        mode: metadata.mode,
        durationMs: Date.now() - metadata.startedAt,
        activeSessions: this.sessions.size,
      });
    }
  }

  getCapacity(): { activeSessions: number; maxSessions: number } {
    return {
      activeSessions: this.sessions.size,
      maxSessions: CONFIG.maxSessions,
    };
  }

  private isReplayedToken(jti: string, exp: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    for (const [tokenId, expiresAt] of this.usedTokenIds) {
      if (expiresAt < now) this.usedTokenIds.delete(tokenId);
    }
    if (this.usedTokenIds.has(jti)) return true;
    this.usedTokenIds.set(jti, exp);
    return false;
  }

  private armHeartbeat(ws: WebSocket): void {
    let alive = true;
    ws.on("pong", () => {
      alive = true;
    });
    const timer = setInterval(() => {
      if (!alive) {
        const metadata = this.sessionMetadata.get(ws);
        logEvent("warn", "session_heartbeat_timeout", {
          sessionId: metadata?.id,
          mode: metadata?.mode,
        });
        ws.terminate();
        return;
      }
      alive = false;
      if (ws.readyState === ws.OPEN) ws.ping();
    }, CONFIG.heartbeatMs);
    timer.unref();
    this.heartbeatTimers.set(ws, timer);
  }
}
