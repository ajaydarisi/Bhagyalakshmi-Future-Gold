import { generateJson } from "@/lib/ai/gemini";
import type {
  CatalogMessage,
  Citation,
  GroundedReply,
  GroundedResponseMode,
  RetrievedContextItem,
} from "@/types/search";

interface GroundedReplyModel {
  answer?: string;
  citations?: Array<{ sourceKey?: string }>;
  followUpPrompt?: string | null;
}

function buildContextBlock(items: RetrievedContextItem[]) {
  return items
    .map((item, index) => {
      const hit = item.hit;
      const lines = [
        `Context ${index + 1}`,
        `sourceKey: ${item.sourceKey}`,
        `sourceType: ${item.sourceType}`,
        `title: ${item.title}`,
        item.slug ? `slug: ${item.slug}` : null,
        hit?.category?.name ? `category: ${hit.category.name}` : null,
        hit?.category?.name_telugu
          ? `categoryTelugu: ${hit.category.name_telugu}`
          : null,
        hit?.material ? `material: ${hit.material}` : null,
        hit?.tags.length ? `tags: ${hit.tags.join(", ")}` : null,
        hit?.is_sale ? `salePrice: ${hit.discount_price ?? hit.price}` : null,
        hit?.is_rental ? `rentalPrice: ${hit.rental_discount_price ?? hit.rental_price}` : null,
        item.snippet ? `details: ${item.snippet}` : null,
      ].filter(Boolean);

      return lines.join("\n");
    })
    .join("\n\n");
}

export async function generateGroundedReply(args: {
  messages: CatalogMessage[];
  locale: string;
  retrievedContext: RetrievedContextItem[];
  responseMode: GroundedResponseMode;
}): Promise<GroundedReply | null> {
  if (args.retrievedContext.length === 0) {
    return null;
  }

  const localeInstruction =
    args.locale === "te"
      ? "Reply in Telugu."
      : "Reply in English.";

  const styleInstruction =
    args.responseMode === "search_answer"
      ? "Give a concise shopping-oriented summary based only on the grounded catalog context."
      : "Act like a helpful shopping assistant, but stay grounded strictly in the provided context.";

  const conversation = args.messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n");

  const context = buildContextBlock(args.retrievedContext.slice(0, 6));

  const prompt = `
You are Bhagyalakshmi Future Gold's grounded catalog assistant.
${localeInstruction}
${styleInstruction}

Only use the provided context. Do not invent products, prices, policies, or availability.
If the context is insufficient, return an empty answer string.

Return strict JSON with this shape:
{
  "answer": "string",
  "citations": [{ "sourceKey": "string" }],
  "followUpPrompt": "string"
}

Use only sourceKey values from the context below.

Conversation:
${conversation}

Context:
${context}
`.trim();

  const parsed = await generateJson<GroundedReplyModel>(prompt);
  const answer = parsed.answer?.trim() ?? "";
  if (!answer) {
    return null;
  }

  const citationMap = new Map<string, Citation>();
  for (const item of args.retrievedContext) {
    citationMap.set(item.sourceKey, {
      sourceType: item.sourceType,
      sourceKey: item.sourceKey,
      title: item.title,
      productId: item.productId,
      slug: item.slug,
    });
  }

  const citations = (parsed.citations ?? [])
    .map((citation) => citation.sourceKey ? citationMap.get(citation.sourceKey) : null)
    .filter((citation): citation is Citation => Boolean(citation));

  return {
    answer,
    citations,
    followUpPrompt: parsed.followUpPrompt?.trim() || null,
  };
}
