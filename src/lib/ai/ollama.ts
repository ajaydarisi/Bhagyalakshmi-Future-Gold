const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text";
const DEFAULT_GENERATION_MODEL = "qwen2.5:7b";
const EXPECTED_DIMENSIONS = 768;
const DEFAULT_OLLAMA_HOST = "https://api.ollama.com";

function getHost() {
  return (process.env.OLLAMA_HOST ?? DEFAULT_OLLAMA_HOST).replace(/\/$/, "");
}

function getApiKey(): string {
  const key = process.env.OLLAMA_API_KEY;
  if (!key) {
    throw new Error("OLLAMA_API_KEY is not configured");
  }
  return key;
}

function getEmbeddingModel() {
  return process.env.OLLAMA_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
}

function getGenerationModel() {
  return process.env.OLLAMA_GENERATION_MODEL ?? DEFAULT_GENERATION_MODEL;
}

export function serializeVector(values: number[]) {
  return `[${values.join(",")}]`;
}

interface OllamaEmbedResponse {
  embeddings?: number[][];
}

interface OllamaChatMessage {
  role: string;
  content: string;
}

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
}

export async function embedText(
  text: string,
  options: {
    taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
    title?: string;
  }
) {
  const host = getHost();
  const apiKey = getApiKey();
  const model = getEmbeddingModel();

  // Task type and title are Gemini-specific; for Ollama we just embed the text.
  // If a title is provided, prepend it to improve document embeddings.
  const inputText = options.title && options.taskType === "RETRIEVAL_DOCUMENT"
    ? `${options.title}\n${text}`
    : text;

  const response = await fetch(`${host}/api/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: inputText }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => null);
    throw new Error(
      `Ollama embed failed: ${response.status} ${response.statusText}${body ? ` — ${body}` : ""}`
    );
  }

  const data = (await response.json()) as unknown;

  // Defensive API-shape contract: must have nested array of numbers
  if (
    typeof data !== "object" ||
    data === null ||
    !("embeddings" in data) ||
    !Array.isArray((data as Record<string, unknown>).embeddings) ||
    !Array.isArray((data as Record<string, unknown[]>).embeddings[0])
  ) {
    throw new Error(
      `Unexpected Ollama embed response shape: expected { embeddings: number[][] }`
    );
  }

  const embedding = (data as { embeddings: number[][] }).embeddings[0];

  if (!embedding || embedding.length === 0) {
    throw new Error("Ollama did not return an embedding");
  }

  if (embedding.length !== EXPECTED_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch: expected ${EXPECTED_DIMENSIONS}, got ${embedding.length}`
    );
  }

  return embedding;
}

export async function generateJson<T>(prompt: string): Promise<T> {
  const host = getHost();
  const apiKey = getApiKey();
  const model = getGenerationModel();

  const messages: OllamaChatMessage[] = [
    {
      role: "system",
      content:
        "You are a helpful assistant. Respond with valid JSON only. Do not output markdown, code fences, or explanatory text outside the JSON.",
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  const response = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => null);
    throw new Error(
      `Ollama generate failed: ${response.status} ${response.statusText}${body ? ` — ${body}` : ""}`
    );
  }

  const data = (await response.json()) as OllamaChatResponse;
  const text = data.message?.content?.trim();

  if (!text) {
    throw new Error("Ollama did not return text");
  }

  // Some models wrap JSON in markdown fences; strip them.
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/i, "");

  return JSON.parse(cleaned) as T;
}
