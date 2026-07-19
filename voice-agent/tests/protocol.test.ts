import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import {
  verifySessionToken,
  VOICE_TOKEN_AUDIENCE,
  VOICE_TOKEN_ISSUER,
} from "../src/auth/session-token.js";
import { parseClientMsg } from "../src/common/protocol.js";

test("control protocol accepts bounded known messages", () => {
  assert.deepEqual(parseClientMsg({ type: "interrupt", utteranceId: 4 }), {
    type: "interrupt",
    utteranceId: 4,
  });
  assert.deepEqual(parseClientMsg({ type: "speak", utteranceId: 4, text: " answer " }), {
    type: "speak",
    utteranceId: 4,
    text: "answer",
  });
  assert.deepEqual(parseClientMsg({ type: "speak_start", utteranceId: 4 }), {
    type: "speak_start",
    utteranceId: 4,
  });
  assert.deepEqual(parseClientMsg({ type: "speak_start", utteranceId: 4, language: "te" }), {
    type: "speak_start",
    utteranceId: 4,
    language: "te",
  });
  assert.deepEqual(parseClientMsg({ type: "speak_delta", utteranceId: 4, text: " first " }), {
    type: "speak_delta",
    utteranceId: 4,
    text: "first",
  });
  assert.deepEqual(parseClientMsg({ type: "speak_end", utteranceId: 4 }), {
    type: "speak_end",
    utteranceId: 4,
  });
  assert.deepEqual(parseClientMsg({ type: "speak_reset", utteranceId: 4 }), {
    type: "speak_reset",
    utteranceId: 4,
  });
});

test("control protocol rejects malformed and oversized messages", () => {
  assert.equal(parseClientMsg({ type: "interrupt", utteranceId: -1 }), null);
  assert.equal(parseClientMsg({ type: "unknown", utteranceId: 1 }), null);
  assert.equal(parseClientMsg({ type: "speak", utteranceId: 1, text: "x".repeat(4001) }), null);
  assert.deepEqual(parseClientMsg({ type: "speak_start", utteranceId: 1, language: "fr" }), {
    type: "speak_start",
    utteranceId: 1,
  });
  assert.equal(
    parseClientMsg({ type: "speak_delta", utteranceId: 1, text: "x".repeat(1001) }),
    null,
  );
});

test("session token verification supports bounded zero-downtime secret rotation", () => {
  const originalSecret = process.env.VOICE_TOKEN_SECRET;
  const originalPreviousSecret = process.env.VOICE_TOKEN_PREVIOUS_SECRET;
  const currentSecret = "current-secret-that-is-long-enough-for-production";
  const previousSecret = "previous-secret-that-is-long-enough-for-production";
  process.env.VOICE_TOKEN_SECRET = currentSecret;
  process.env.VOICE_TOKEN_PREVIOUS_SECRET = previousSecret;

  try {
    const token = jwt.sign({}, previousSecret, {
      algorithm: "HS256",
      audience: VOICE_TOKEN_AUDIENCE,
      expiresIn: "60s",
      issuer: VOICE_TOKEN_ISSUER,
      jwtid: randomUUID(),
    });
    assert.ok(verifySessionToken(token));

    delete process.env.VOICE_TOKEN_PREVIOUS_SECRET;
    assert.equal(verifySessionToken(token), null);
  } finally {
    if (originalSecret === undefined) delete process.env.VOICE_TOKEN_SECRET;
    else process.env.VOICE_TOKEN_SECRET = originalSecret;
    if (originalPreviousSecret === undefined) delete process.env.VOICE_TOKEN_PREVIOUS_SECRET;
    else process.env.VOICE_TOKEN_PREVIOUS_SECRET = originalPreviousSecret;
  }
});
