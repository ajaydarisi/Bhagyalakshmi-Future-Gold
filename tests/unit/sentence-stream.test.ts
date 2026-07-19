import { describe, expect, it } from "vitest";
import { SentenceStream } from "@/lib/voice/sentence-stream";

describe("voice sentence streaming", () => {
  it("emits a completed sentence as soon as terminal punctuation streams in", () => {
    const stream = new SentenceStream();
    expect(stream.push("Here are wedding ")).toEqual([]);
    expect(stream.push("earrings.")).toEqual(["Here are wedding earrings."]);
    expect(stream.finish()).toEqual([]);
  });

  it("buffers incomplete text and flushes only after generation finishes", () => {
    const stream = new SentenceStream();
    expect(stream.push("A short unfinished answer")).toEqual([]);
    expect(stream.finish()).toEqual(["A short unfinished answer"]);
  });

  it("drops buffered draft text when structured generation resets", () => {
    const stream = new SentenceStream();
    stream.push("Wrong draft");
    stream.reset();
    expect(stream.push("Correct answer.")).toEqual(["Correct answer."]);
  });
});
