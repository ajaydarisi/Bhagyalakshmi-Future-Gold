import { GoogleGenAI } from "@google/genai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { Output, streamText } from "ai";
import type { z } from "zod";

const EMBEDDING_MODEL = "gemini-embedding-001";
const GENERATION_MODEL = "gemini-2.5-flash";
const EMBEDDING_DIMENSIONS = 768;
const DEFAULT_AI_HTTP_TIMEOUT_MS = 12_000;

let client: GoogleGenAI | null = null;
let streamingProvider: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getHttpTimeout() {
  const configuredTimeout = Number(process.env.AI_HTTP_TIMEOUT_MS);
  return Number.isFinite(configuredTimeout)
    ? Math.min(30_000, Math.max(5_000, configuredTimeout))
    : DEFAULT_AI_HTTP_TIMEOUT_MS;
}

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  if (!client) {
    client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { timeout: getHttpTimeout() },
    });
  }

  return client;
}

function getStreamingModel() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  if (!streamingProvider) {
    streamingProvider = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  return streamingProvider(GENERATION_MODEL);
}

export function serializeVector(values: number[]) {
  return `[${values.join(",")}]`;
}

export async function embedText(
  text: string,
  options: {
    taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
    title?: string;
    signal?: AbortSignal;
    /** Voice turns: fail fast to keyword-only rather than retrying. */
    singleAttempt?: boolean;
  }
) {
  const ai = getClient();
  const embed = async () => {
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: {
        taskType: options.taskType,
        title: options.title,
        outputDimensionality: EMBEDDING_DIMENSIONS,
        abortSignal: options.signal,
      },
    });

    const embedding = response.embeddings?.[0]?.values;
    if (!embedding || embedding.length === 0) {
      throw new Error("Gemini did not return an embedding");
    }

    return embedding;
  };

  try {
    return await embed();
  } catch (error) {
    // One retry: a failed query embedding degrades retrieval to keyword-only,
    // which grounds far worse than a short delay. But the failure that matters
    // is a TIMEOUT, and 2 x AI_HTTP_TIMEOUT_MS (24s default) does not fit inside
    // a voice turn's 30s budget — so voice degrades instead of retrying. Hybrid
    // search still returns FTS results with no embedding.
    if (options.singleAttempt) throw error;
    return await embed();
  }
}

export async function generateJson<T>(
  prompt: string,
  options: { signal?: AbortSignal; responseJsonSchema?: unknown } = {}
): Promise<T> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: GENERATION_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      // Keep the JSON shape constrained at the provider boundary when a
      // caller has a schema. Callers still validate the parsed value locally:
      // model output remains untrusted input.
      ...(options.responseJsonSchema
        ? { responseJsonSchema: options.responseJsonSchema }
        : {}),
      abortSignal: options.signal,
      // Grounded extraction/summarization, not multi-step reasoning — thinking
      // only adds dead air before the first token.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error("Gemini did not return JSON");
  }

  return JSON.parse(text) as T;
}

export async function streamJson<T>(args: {
  prompt: string;
  schema: z.ZodType<T>;
  signal?: AbortSignal;
  onPartial: (partial: unknown) => void;
}): Promise<T> {
  const result = streamText({
    model: getStreamingModel(),
    output: Output.object({ schema: args.schema }),
    prompt: args.prompt,
    abortSignal: args.signal,
    timeout: { totalMs: getHttpTimeout(), chunkMs: 8_000 },
    providerOptions: {
      google: { thinkingConfig: { thinkingBudget: 0 } },
    },
  });

  for await (const partial of result.partialOutputStream) {
    args.onPartial(partial);
  }

  return await result.output;
}
