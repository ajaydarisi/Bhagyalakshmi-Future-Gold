import { GoogleGenAI } from "@google/genai";

const EMBEDDING_MODEL = "gemini-embedding-001";
const GENERATION_MODEL = "gemini-2.5-flash";
const EMBEDDING_DIMENSIONS = 768;

let client: GoogleGenAI | null = null;

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  return client;
}

export function serializeVector(values: number[]) {
  return `[${values.join(",")}]`;
}

export async function embedText(
  text: string,
  options: {
    taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
    title?: string;
  }
) {
  const ai = getClient();
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      taskType: options.taskType,
      title: options.title,
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  });

  const embedding = response.embeddings?.[0]?.values;
  if (!embedding || embedding.length === 0) {
    throw new Error("Gemini did not return an embedding");
  }

  return embedding;
}

export async function generateJson<T>(
  prompt: string
): Promise<T> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: GENERATION_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error("Gemini did not return JSON");
  }

  return JSON.parse(text) as T;
}
