import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import type WebSocket from "ws";
import type { ClientMsg, ServerMsg } from "../src/common/protocol.js";
import type { SttClient } from "../src/providers/sarvam-stt.client.js";
import type {
  TtsHandlers,
  TtsUtterance,
} from "../src/providers/sarvam-tts.client.js";
import { VoiceSession } from "../src/session/voice-session.js";

class FakeStt extends EventEmitter {
  connect() {}
  sendAudio() {}
  flush() {}
  close() {}
}

class FakeSocket {
  readonly OPEN = 1;
  readyState = 1;
  bufferedAmount = 0;
  messages: ServerMsg[] = [];

  send(value: string) {
    this.messages.push(JSON.parse(value) as ServerMsg);
  }

  close() {
    this.readyState = 3;
  }
}

class FakeTts implements TtsUtterance {
  sent: string[] = [];
  flushCount = 0;
  closed = false;

  constructor(
    readonly handlers: TtsHandlers,
    readonly languageCode: string,
  ) {}

  sendText(text: string) {
    this.sent.push(text);
  }

  flush() {
    this.flushCount += 1;
  }

  close() {
    this.closed = true;
  }
}

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function createSession(responseTimeoutMs = 200) {
  const socket = new FakeSocket();
  const stt = new FakeStt();
  const ttsUtterances: FakeTts[] = [];
  const session = new VoiceSession(
    socket as unknown as WebSocket,
    () => {},
    "assistant",
    "en-IN",
    {
      stt: stt as unknown as SttClient,
      openTts: (handlers, languageCode = "te-IN") => {
        const tts = new FakeTts(handlers, languageCode);
        ttsUtterances.push(tts);
        return tts;
      },
      assistantSettleMs: 25,
      assistantResponseTimeoutMs: responseTimeoutMs,
    },
  );
  return { session, socket, stt, ttsUtterances };
}

function transcripts(messages: ServerMsg[]) {
  return messages.filter(
    (message): message is Extract<ServerMsg, { type: "transcript" }> =>
      message.type === "transcript",
  );
}

test("assistant waits through a short pause and submits one combined turn", async () => {
  const { session, socket, stt } = createSession();
  stt.emit("transcript", "show me");
  await wait(10);
  stt.emit("vad", "START_SPEECH");
  await wait(35);
  assert.equal(transcripts(socket.messages).length, 0);

  stt.emit("transcript", "wedding earrings");
  await wait(35);
  assert.deepEqual(transcripts(socket.messages).map((message) => message.text), [
    "show me wedding earrings",
  ]);
  session.destroy();
});

test("speech resuming during thinking cancels the stale turn and preserves context", async () => {
  const { session, socket, stt } = createSession();
  stt.emit("transcript", "show me earrings");
  await wait(35);
  const firstTurn = transcripts(socket.messages)[0];
  assert.ok(firstTurn);

  // A raw VAD blip (ambient noise) must NOT cancel the in-flight turn…
  stt.emit("vad", "START_SPEECH");
  assert.equal(
    socket.messages.some((message) => message.type === "turn_cancelled"),
    false,
  );

  // …only recognized words do.
  stt.emit("transcript", "under one thousand rupees");
  assert.ok(
    socket.messages.some(
      (message) =>
        message.type === "turn_cancelled" &&
        message.utteranceId === firstTurn.utteranceId &&
        message.reason === "barge_in",
    ),
  );
  await wait(35);
  assert.deepEqual(transcripts(socket.messages).map((message) => message.text), [
    "show me earrings",
    "show me earrings under one thousand rupees",
  ]);

  const staleResponse: ClientMsg = {
    type: "speak",
    utteranceId: firstTurn.utteranceId,
    text: "stale answer",
  };
  session.onControl(staleResponse);
  assert.equal(
    socket.messages.some(
      (message) => message.type === "assistant_text" && message.text === "stale answer",
    ),
    false,
  );
  session.destroy();
});

test("a missing storefront response times out and returns to listening", async () => {
  const { session, socket, stt } = createSession(30);
  stt.emit("transcript", "show me necklaces");
  await wait(70);

  assert.ok(
    socket.messages.some(
      (message) =>
        message.type === "error" &&
        message.code === "assistant_timeout" &&
        message.recoverable === true,
    ),
  );
  const finalMessage = socket.messages.at(-1);
  assert.equal(finalMessage?.type === "state" ? finalMessage.value : null, "listening");
  session.destroy();
});

test("grounded speech streams each completed sentence into TTS before speak_end", async () => {
  const { session, socket, stt, ttsUtterances } = createSession();
  stt.emit("transcript", "show me wedding earrings");
  await wait(35);
  const turn = transcripts(socket.messages)[0];
  assert.ok(turn);

  session.onControl({ type: "speak_start", utteranceId: turn.utteranceId });
  session.onControl({
    type: "speak_delta",
    utteranceId: turn.utteranceId,
    text: "Here are grounded matches.",
  });

  assert.equal(ttsUtterances.length, 1);
  assert.deepEqual(ttsUtterances[0]?.sent, ["Here are grounded matches."]);
  assert.equal(ttsUtterances[0]?.flushCount, 0);
  assert.ok(
    socket.messages.some(
      (message) => message.type === "state" && message.value === "speaking",
    ),
  );

  session.onControl({ type: "speak_end", utteranceId: turn.utteranceId });
  assert.equal(ttsUtterances[0]?.flushCount, 1);
  session.destroy();
});

test("bracketed asides are stripped from speech but sentence flow is kept", async () => {
  const { session, socket, stt, ttsUtterances } = createSession();
  stt.emit("transcript", "who is the owner");
  await wait(35);
  const turn = transcripts(socket.messages)[0];
  assert.ok(turn);

  session.onControl({ type: "speak_start", utteranceId: turn.utteranceId });
  session.onControl({
    type: "speak_delta",
    utteranceId: turn.utteranceId,
    text: "ఈ వెబ్సైట్‌ను దరిసి భాగ్యలక్ష్మి (Darisi Bhagyalakshmi) గారు నిర్వహిస్తారు. ఆమె స్టోర్ యజమాని (Owner / Proprietor).",
  });

  assert.deepEqual(ttsUtterances[0]?.sent, [
    "ఈ వెబ్సైట్‌ను దరిసి భాగ్యలక్ష్మి గారు నిర్వహిస్తారు. ఆమె స్టోర్ యజమాని.",
  ]);
  session.destroy();
});

test("grounded speech can select Telugu TTS for a Telugu voice turn", async () => {
  const { session, socket, stt, ttsUtterances } = createSession();
  stt.emit("transcript", "వెడ్డింగ్ హారాలు చూపించండి");
  await wait(35);
  const turn = transcripts(socket.messages)[0];
  assert.ok(turn);

  session.onControl({ type: "speak_start", utteranceId: turn.utteranceId, language: "te" });
  session.onControl({
    type: "speak_delta",
    utteranceId: turn.utteranceId,
    text: "ఇవి కొన్ని మంచి designs.",
  });

  assert.equal(ttsUtterances.length, 1);
  assert.equal(ttsUtterances[0]?.languageCode, "te-IN");
  assert.deepEqual(ttsUtterances[0]?.sent, ["ఇవి కొన్ని మంచి designs."]);
  session.destroy();
});

test("a generation reset cancels the draft TTS stream and starts a clean one", async () => {
  const { session, stt, socket, ttsUtterances } = createSession();
  stt.emit("transcript", "show me necklaces");
  await wait(35);
  const turn = transcripts(socket.messages)[0];
  assert.ok(turn);

  session.onControl({ type: "speak_start", utteranceId: turn.utteranceId });
  session.onControl({ type: "speak_delta", utteranceId: turn.utteranceId, text: "Draft." });
  session.onControl({ type: "speak_reset", utteranceId: turn.utteranceId });
  session.onControl({ type: "speak_delta", utteranceId: turn.utteranceId, text: "Correct." });

  assert.equal(ttsUtterances.length, 2);
  assert.equal(ttsUtterances[0]?.closed, true);
  assert.deepEqual(ttsUtterances[1]?.sent, ["Correct."]);
  assert.ok(
    socket.messages.some(
      (message) =>
        message.type === "audio_reset" && message.utteranceId === turn.utteranceId,
    ),
  );
  session.destroy();
});

test("barge-in invalidates later speech chunks from the cancelled response", async () => {
  const { session, stt, socket, ttsUtterances } = createSession();
  stt.emit("transcript", "show me earrings");
  await wait(35);
  const turn = transcripts(socket.messages)[0];
  assert.ok(turn);

  session.onControl({ type: "speak_start", utteranceId: turn.utteranceId });
  session.onControl({ type: "speak_delta", utteranceId: turn.utteranceId, text: "First." });
  session.onControl({ type: "interrupt", utteranceId: turn.utteranceId });
  session.onControl({ type: "speak_delta", utteranceId: turn.utteranceId, text: "Stale." });

  assert.equal(ttsUtterances[0]?.closed, true);
  assert.deepEqual(ttsUtterances[0]?.sent, ["First."]);
  session.destroy();
});
