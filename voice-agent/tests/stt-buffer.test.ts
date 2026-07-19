import assert from "node:assert/strict";
import { test } from "node:test";
import { CONFIG } from "../src/common/config.js";
import { isSttAudioBackpressured } from "../src/providers/sarvam-stt.client.js";

test("STT audio queue drops frames at the configured high-water mark", () => {
  assert.equal(isSttAudioBackpressured(CONFIG.maxSttBufferedBytes - 1), false);
  assert.equal(isSttAudioBackpressured(CONFIG.maxSttBufferedBytes), true);
  assert.equal(isSttAudioBackpressured(CONFIG.maxSttBufferedBytes + 1), true);
});
