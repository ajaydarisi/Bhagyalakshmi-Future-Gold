// Short-lived HS256 session tokens. The Next.js route /api/voice/token signs
// with the same VOICE_TOKEN_SECRET; the gateway verifies before the WS upgrade
// completes. Tokens expire after 60s and the gateway rejects replayed jti values.
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../common/env.js";

export const VOICE_TOKEN_ISSUER = "bfg-storefront";
export const VOICE_TOKEN_AUDIENCE = "bfg-voice-agent";

export function mintSessionToken(sub?: string): string {
  return jwt.sign(sub ? { sub } : {}, env("VOICE_TOKEN_SECRET"), {
    algorithm: "HS256",
    audience: VOICE_TOKEN_AUDIENCE,
    expiresIn: "60s",
    issuer: VOICE_TOKEN_ISSUER,
    jwtid: randomUUID(),
  });
}

export interface VoiceTokenClaims {
  exp: number;
  jti: string;
  sub?: string;
}

export function verifySessionToken(token: string): VoiceTokenClaims | null {
  const secrets = [env("VOICE_TOKEN_SECRET"), process.env.VOICE_TOKEN_PREVIOUS_SECRET]
    .filter((secret): secret is string => Boolean(secret));
  for (const secret of secrets) {
    try {
      const payload = jwt.verify(token, secret, {
        algorithms: ["HS256"],
        audience: VOICE_TOKEN_AUDIENCE,
        issuer: VOICE_TOKEN_ISSUER,
        clockTolerance: 5,
      });
      if (
        typeof payload === "string" ||
        typeof payload.exp !== "number" ||
        typeof payload.jti !== "string"
      ) {
        return null;
      }
      return {
        exp: payload.exp,
        jti: payload.jti,
        sub: typeof payload.sub === "string" ? payload.sub : undefined,
      };
    } catch {
      // During rotation, try the previous secret before rejecting the token.
    }
  }
  return null;
}
