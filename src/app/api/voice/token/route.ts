import crypto from "node:crypto";
import { NextResponse } from "next/server";

const VOICE_TOKEN_ISSUER = "bfg-storefront";
const VOICE_TOKEN_AUDIENCE = "bfg-voice-agent";
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
};

// Mints a 60s HS256 session token for the voice service (voice-agent verifies
// with the same VOICE_TOKEN_SECRET). Signing our own fixed payload — no JWT
// library needed.
const b64u = (s: string | Buffer) => Buffer.from(s).toString("base64url");

// ponytail: instance-local rate limit; move to a shared store if the voice
// feature ever outgrows one serverless instance's traffic.
//
// The budget is per IP, and an IP is not a customer: local dev collapses every
// tab onto 127.0.0.1, and in production a carrier NAT puts a whole town behind
// one address (the voice-agent's own per-client cap calls this out and sizes
// for it). One voice attempt costs up to 2 mints — the start plus the bounded
// reconnect — so a tight budget locks out real users after a handful of taps.
// Concurrency is capped by the voice-agent (2 live sessions per client, and
// each token is single-use via its jti); a mint is one HMAC, so this only has
// to bound spam.
const MINTS_PER_MINUTE = 60;
const hits = new Map<string, { n: number; t: number }>();

export async function POST(request: Request) {
  const secret = process.env.VOICE_TOKEN_SECRET;
  if (!secret || (process.env.NODE_ENV === "production" && secret.length < 32)) {
    return NextResponse.json(
      { error: "voice_disabled" },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  // Reverse proxies can expose an internal host in request.url. Modern
  // browsers provide Sec-Fetch-Site from the actual navigation context, so a
  // genuine same-origin POST remains valid while cross-site browser requests
  // and explicit foreign origins are rejected.
  const browserSameOrigin = fetchSite === "same-origin";
  if (
    fetchSite === "cross-site" ||
    (origin && !browserSameOrigin && origin !== requestOrigin)
  ) {
    return NextResponse.json(
      { error: "origin_not_allowed" },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const now = Date.now();
  if (hits.size > 5000) hits.clear();
  const h = hits.get(ip);
  if (h && now - h.t < 60_000) {
    if (++h.n > MINTS_PER_MINUTE) {
      return NextResponse.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: { ...NO_STORE_HEADERS, "Retry-After": "60" },
        },
      );
    }
  } else {
    hits.set(ip, { n: 1, t: now });
  }

  const iat = Math.floor(now / 1000);
  const header = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64u(JSON.stringify({
    aud: VOICE_TOKEN_AUDIENCE,
    exp: iat + 60,
    iat,
    iss: VOICE_TOKEN_ISSUER,
    jti: crypto.randomUUID(),
    sub: crypto.createHash("sha256").update(ip).digest("base64url").slice(0, 22),
  }));
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return NextResponse.json(
    { token: `${header}.${payload}.${sig}` },
    { headers: NO_STORE_HEADERS },
  );
}
