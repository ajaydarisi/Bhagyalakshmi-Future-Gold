// Regression: the mint limiter budgeted 10/minute per IP. An IP is not a
// customer — dev collapses every tab onto 127.0.0.1 and a carrier NAT shares one
// address — and a single voice attempt costs up to two mints, so a few taps
// exhausted the minute and every retry surfaced as "Could not reach the voice
// assistant". Found by /qa on 2026-08-30.
// Report: .gstack/qa-reports/qa-report-localhost-2026-08-30.md
import { beforeEach, describe, expect, it, vi } from "vitest";

const IP = "203.0.113.7";

async function loadRoute() {
  vi.resetModules(); // the limiter's counters are module-level state
  return (await import("@/app/api/voice/token/route")).POST;
}

function mint(ip: string) {
  return new Request("http://localhost:3000/api/voice/token", {
    method: "POST",
    headers: { "x-forwarded-for": ip, "sec-fetch-site": "same-origin" },
  });
}

describe("voice token route", () => {
  beforeEach(() => {
    process.env.VOICE_TOKEN_SECRET = "a".repeat(64);
  });

  it("mints a full minute of attempts before throttling one IP", async () => {
    const POST = await loadRoute();
    for (let attempt = 1; attempt <= 60; attempt += 1) {
      const response = await POST(mint(IP));
      expect(response.status, `mint ${attempt} should succeed`).toBe(200);
    }
    const throttled = await POST(mint(IP));
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("Retry-After")).toBe("60");
  });

  it("budgets each IP separately", async () => {
    const POST = await loadRoute();
    for (let attempt = 0; attempt < 61; attempt += 1) await POST(mint(IP));
    const neighbour = await POST(mint("198.51.100.4"));
    expect(neighbour.status).toBe(200);
  });

  it("returns a signed three-part token", async () => {
    const POST = await loadRoute();
    const response = await POST(mint(IP));
    const { token } = (await response.json()) as { token: string };
    expect(token.split(".")).toHaveLength(3);
    const [, payload] = token.split(".");
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toMatchObject({
      aud: "bfg-voice-agent",
      iss: "bfg-storefront",
    });
  });

  it("rejects a cross-site mint", async () => {
    const POST = await loadRoute();
    const response = await POST(
      new Request("http://localhost:3000/api/voice/token", {
        method: "POST",
        headers: { "x-forwarded-for": IP, "sec-fetch-site": "cross-site" },
      }),
    );
    expect(response.status).toBe(403);
  });
});
