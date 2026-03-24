import enAssistant from "../../messages/en/assistant.json";
import teAssistant from "../../messages/te/assistant.json";
import { BUSINESS_INFO } from "@/lib/constants";
import type {
  AssistantFallbackReason,
  AssistantFollowUpSuggestion,
  AssistantHandoff,
  AssistantPageContext,
  AssistantReply,
  CatalogMessage,
  ProductSearchFilters,
} from "@/types/search";

const ASSISTANT_COPY = {
  en: enAssistant,
  te: teAssistant,
} as const;
const ASSISTANT_PRODUCT_QUERY_STOP_WORDS = new Set([
  "what",
  "can",
  "i",
  "me",
  "show",
  "tell",
  "please",
  "need",
  "want",
  "the",
  "a",
  "an",
  "for",
  "with",
  "of",
  "to",
  "this",
  "that",
  "these",
  "those",
  "is",
  "are",
  "do",
  "you",
  "item",
  "items",
  "product",
  "products",
  "catalog",
  "catalogue",
  "rupees",
  "rupee",
  "rs",
  "inr",
]);

function getAssistantCopy(locale: string) {
  return locale === "te" ? ASSISTANT_COPY.te : ASSISTANT_COPY.en;
}

function sanitizeHandoffSummary(message: string) {
  return message
    .trim()
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .replace(/\+?\d[\d\s()-]{6,}\d/g, "[redacted number]")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

export function buildAssistantHandoff(
  latestMessage: string,
  locale: string
): AssistantHandoff {
  const t = getAssistantCopy(locale);
  const intro =
    locale === "te"
      ? "నాకు సహాయం కావాలి:"
      : "Hello, I need help with:";
  const summaryLabel = locale === "te" ? "వివరాలు" : "Details";
  const summary = sanitizeHandoffSummary(latestMessage);

  const url = `https://wa.me/91${BUSINESS_INFO.whatsapp}?text=${encodeURIComponent(
    summary ? `${intro}\n\n${summaryLabel}: ${summary}` : intro
  )}`;

  return {
    type: "whatsapp",
    label: t.handoffButton,
    url,
  };
}

export function buildAssistantFallbackReply(args: {
  locale: string;
  reason: AssistantFallbackReason;
}): AssistantReply {
  const t = getAssistantCopy(args.locale);

  return {
    answer:
      args.reason === "unsupported_scope"
        ? t.unsupportedScope
        : args.reason === "generation_error"
          ? t.generationError
          : t.noGrounding,
    citations: [],
    followUpSuggestions:
      args.reason === "unsupported_scope" ? [] : buildStarterSuggestions(args.locale),
    fallbackReason: args.reason,
  };
}

export function buildAssistantGreetingReply(locale: string): AssistantReply {
  const t = getAssistantCopy(locale);
  const greeting = locale === "te" ? "హాయ్!" : "Hi!";

  return {
    answer: `${greeting} ${t.welcomeDescription}`,
    citations: [],
    followUpSuggestions: buildStarterSuggestions(locale),
    fallbackReason: null,
  };
}

export function buildAssistantThanksReply(locale: string): AssistantReply {
  const t = getAssistantCopy(locale);

  return {
    answer: t.thanksReply,
    citations: [],
    followUpSuggestions: buildStarterSuggestions(locale),
    fallbackReason: null,
  };
}

export function buildAssistantByeReply(locale: string): AssistantReply {
  const t = getAssistantCopy(locale);

  return {
    answer: t.byeReply,
    citations: [],
    followUpSuggestions: buildStarterSuggestions(locale),
    fallbackReason: null,
  };
}

export function buildAssistantCapabilityReply(locale: string): AssistantReply {
  const t = getAssistantCopy(locale);

  return {
    answer: t.helpReply,
    citations: [],
    followUpSuggestions: buildStarterSuggestions(locale),
    fallbackReason: null,
  };
}

export function buildStarterSuggestions(locale: string): AssistantFollowUpSuggestion[] {
  const t = getAssistantCopy(locale);

  return [
    t.starterPrompts.discovery,
    t.starterPrompts.rental,
    t.starterPrompts.budget,
    t.starterPrompts.policy,
  ].map((prompt) => ({
    label: prompt,
    prompt,
    sourceKeys: [],
  }));
}

function normalizeAssistantText(query: string) {
  return query
    .trim()
    .toLowerCase()
    .replace(/[!?.,]+$/g, "")
    .replace(/\s+/g, " ");
}

function stripLeadInPhrases(query: string) {
  return query
    .trim()
    .replace(
      /^(can you|could you|please|hey|hi|hello|tell me|show me|what about|how about)\s+/i,
      ""
    )
    .replace(
      /^(దయచేసి|చూపించు|చూపించండి|చెప్పు|చెప్పండి|ఏమిటి|ఎలా)\s+/,
      ""
    )
    .trim();
}

function normalizeAssistantSearchPhrase(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueAssistantQueryParts(parts: Array<string | null | undefined>) {
  return [...new Set(parts.map((part) => normalizeAssistantSearchPhrase(part ?? "")).filter(Boolean))];
}

function parseAssistantPriceValue(rawValue: string) {
  const normalized = rawValue.replace(/,/g, "").trim().toLowerCase();
  const numericValue = Number.parseFloat(
    normalized.endsWith("k") ? normalized.slice(0, -1) : normalized
  );

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return Math.round(normalized.endsWith("k") ? numericValue * 1000 : numericValue);
}

function extractAssistantMaxPrice(query: string) {
  const patterns = [
    /(?:under|below|less than|within|up to|upto|max(?:imum)?(?: price)?)[^\d]{0,8}([\d,.]+(?:\s*[kK])?)/i,
    /(?:లోపు|కంటే తక్కువ|బడ్జెట్)[^\d]{0,8}([\d,.]+(?:\s*[kK])?)/,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    const value = match?.[1] ? parseAssistantPriceValue(match[1]) : null;
    if (value) {
      return value;
    }
  }

  return null;
}

function resolveAssistantProductType(query: string): ProductSearchFilters["type"] | null {
  const hasRentalIntent =
    /\b(rent|rental|for rent|hire|per day)\b/i.test(query) || /అద్దె/.test(query);
  const hasSaleIntent =
    /\b(buy|shop|purchase|for sale|own)\b/i.test(query) || /కొన|కొనాలి/.test(query);

  if (hasRentalIntent && !hasSaleIntent) {
    return "rental";
  }

  if (hasSaleIntent && !hasRentalIntent) {
    return "sale";
  }

  return null;
}

export function buildAssistantSearchFilters(
  query: string
): ProductSearchFilters | undefined {
  const filters: ProductSearchFilters = {};
  const maxPrice = extractAssistantMaxPrice(query);
  const type = resolveAssistantProductType(query);

  if (maxPrice) {
    filters.maxPrice = maxPrice;
  }

  if (type) {
    filters.type = type;
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}

export function shouldPreferAssistantPriceAscending(query: string) {
  return (
    /\b(cheap|cheapest|cheaper|lowest|least expensive|most affordable|budget|under|below|low price)\b/i.test(
      query
    ) || /(చౌక|తక్కువ ధర|బడ్జెట్|లోపు)/.test(query)
  );
}

export function buildAssistantProductSearchQuery(args: {
  latestUserMessage: string;
  pageContext?: AssistantPageContext | null;
}) {
  const filters = buildAssistantSearchFilters(args.latestUserMessage);
  const cleanedMessage = normalizeAssistantSearchPhrase(
    stripLeadInPhrases(args.latestUserMessage).toLowerCase()
  )
    .replace(
      /\b(under|below|less than|within|up to|upto|max(?:imum)?|cheap|cheapest|cheaper|lowest|least expensive|most affordable|budget|price|prices|cost|costs|buy|shop|purchase|rent|rental)\b/g,
      " "
    )
    .replace(/\b\d[\d,.]*(?:\s*[kK])?\b/g, " ");
  const tokens = cleanedMessage
    .split(/\s+/)
    .filter((token) => token && !ASSISTANT_PRODUCT_QUERY_STOP_WORDS.has(token));
  const uniqueTokens = [...new Set(tokens)];

  if (filters?.type === "rental" && !uniqueTokens.includes("rental")) {
    uniqueTokens.unshift("rental");
  }

  if (
    filters?.type === "rental" &&
    uniqueTokens.every((token) => token === "rental")
  ) {
    return "rental jewellery";
  }

  if (uniqueTokens.length === 0) {
    if (args.pageContext?.product?.name.trim()) {
      return args.pageContext.product.name.trim();
    }

    return filters?.type === "rental" ? "rental jewellery" : "jewellery";
  }

  return uniqueTokens.join(" ");
}

export function isAssistantGreeting(query: string) {
  const normalized = normalizeAssistantText(query);
  if (!normalized) {
    return false;
  }

  return /^(hi|hello|hey|hai|hii|namaste|namaskaram|హాయ్|హలో|నమస్తే)(\s+(there|assistant|team))?$/i.test(
    normalized
  );
}

export function isAssistantThanks(query: string) {
  const normalized = normalizeAssistantText(query);
  if (!normalized) {
    return false;
  }

  return /^(thanks|thank you|thanks a lot|thankyou|thx|ty|ధన్యవాదాలు|చాలా ధన్యవాదాలు|థాంక్స్)(\s+(so much|assistant))?$/i.test(
    normalized
  );
}

export function isAssistantBye(query: string) {
  const normalized = normalizeAssistantText(query);
  if (!normalized) {
    return false;
  }

  return /^(bye|goodbye|see you|see you later|ok bye|టాటా|బై|మళ్లీ కలుద్దాం)(\s+(assistant|again))?$/i.test(
    normalized
  );
}

export function isAssistantCapabilityRequest(query: string) {
  const normalized = normalizeAssistantText(query);
  if (!normalized) {
    return false;
  }

  return [
    /^help( me)?$/,
    /^support$/,
    /^what can you do( for me)?$/,
    /^what can you help with$/,
    /^how can you help( me)?$/,
    /^can you help( me)?$/,
    /^what do you do$/,
    /^సహాయం$/,
    /^మీరు ఏమి చేయగలరు$/,
    /^ఏం చేయగలరు$/,
    /^ఏమి చేయగలరు$/,
  ].some((pattern) => pattern.test(normalized));
}

export function buildAssistantIntentReply(
  query: string,
  locale: string
): AssistantReply | null {
  if (isAssistantGreeting(query)) {
    return buildAssistantGreetingReply(locale);
  }

  if (isAssistantThanks(query)) {
    return buildAssistantThanksReply(locale);
  }

  if (isAssistantBye(query)) {
    return buildAssistantByeReply(locale);
  }

  if (isAssistantCapabilityRequest(query)) {
    return buildAssistantCapabilityReply(locale);
  }

  return null;
}

export function resolveAssistantQuery(args: {
  messages: CatalogMessage[];
  pageContext?: AssistantPageContext | null;
}) {
  const latestUserMessage = [...args.messages]
    .reverse()
    .find((message) => message.role === "user")
    ?.content
    .trim();

  const previousUserMessage = [...args.messages]
    .reverse()
    .filter((message) => message.role === "user")
    .at(1)
    ?.content
    .trim();

  const parts = uniqueAssistantQueryParts([
    latestUserMessage,
    previousUserMessage,
    args.pageContext?.product?.name
      ? args.pageContext.product.name
      : null,
    args.pageContext?.search?.query
      ? args.pageContext.search.query
      : null,
    args.pageContext?.search?.categories?.length
      ? args.pageContext.search.categories.join(" ")
      : null,
    args.pageContext?.cart?.itemNames?.length
      ? args.pageContext.cart.itemNames.slice(0, 5).join(" ")
      : null,
  ]);

  return parts.join("\n");
}

export function broadenAssistantQuery(args: {
  latestUserMessage: string;
  messages: CatalogMessage[];
  pageContext?: AssistantPageContext | null;
}) {
  const previousUserMessage = [...args.messages]
    .reverse()
    .filter((message) => message.role === "user")
    .at(1)
    ?.content
    .trim();

  const keyPhrases = uniqueAssistantQueryParts([
    stripLeadInPhrases(args.latestUserMessage),
    previousUserMessage ? stripLeadInPhrases(previousUserMessage) : null,
    args.pageContext?.product?.name ?? null,
    args.pageContext?.search?.query ?? null,
    ...(args.pageContext?.search?.categories ?? []).map((value) => value),
    ...(args.pageContext?.cart?.itemNames?.slice(0, 3) ?? []).map((value) => value),
    "products",
    "materials",
    "categories",
    "rental",
    "sale",
    "pricing",
    "store information",
    "policies",
  ]);

  return [...new Set(keyPhrases)].join(", ");
}

export function isUnsupportedAssistantRequest(query: string) {
  const normalized = normalizeAssistantText(query);
  if (!normalized) {
    return false;
  }

  const publicInfoPatterns = [
    /\b(refund|return|shipping|delivery|payment|privacy|rental)\s+(policy|policies|terms|options|charges|fees)\b/,
    /\b(policy|policies|terms|options|charges|fees)\s+for\s+(refunds?|returns?|shipping|delivery|payments?|rentals?)\b/,
    /రిఫండ్ పాలసీ/,
    /రిటర్న్ పాలసీ/,
    /డెలివరీ పాలసీ/,
    /షిప్పింగ్ పాలసీ/,
    /చెల్లింపు ఎంపికలు/,
    /అద్దె పాలసీ/,
  ];

  if (publicInfoPatterns.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  const privateSupportPatterns = [
    /\bmy order\b/,
    /\bwhere is my order\b/,
    /\bwhen (will|does) my order\b/,
    /\btrack(ing)? (my )?(order|shipment|delivery)\b/,
    /\border (status|update)\b/,
    /\bcancel (my )?order\b/,
    /\bexchange (my )?order\b/,
    /\breplace (my )?order\b/,
    /\brefund (for )?(my )?order\b/,
    /\brefund status\b/,
    /\bmy account\b/,
    /\baccount (issue|problem|locked)\b/,
    /\b(can'?t|cannot|unable to)\s+(log[ -]?in|sign in)\b/,
    /\bforgot password\b/,
    /\breset password\b/,
    /\blog[ -]?in issue\b/,
    /\botp\b/,
    /\baddress (change|update)\b/,
    /\bchange (my )?(address|phone number|email)\b/,
    /\bpayment (failed|issue|problem)\b/,
    /\bfailed payment\b/,
    /\btransaction\b/,
    /\bupi\b/,
    /\bcard payment\b/,
    /\bdelivery status\b/,
    /\bshipment status\b/,
    /నా ఆర్డర్/,
    /ఆర్డర్ స్థితి/,
    /ఆర్డర్ స్టేటస్/,
    /ఆర్డర్ ఎక్కడ/,
    /డెలివరీ స్టేటస్/,
    /షిప్మెంట్ స్టేటస్/,
    /రిఫండ్ స్టేటస్/,
    /చెల్లింపు విఫలమైంది/,
    /పేమెంట్ ఫెయిల్/,
    /లాగిన్ సమస్య/,
    /పాస్వర్డ్ రీసెట్/,
    /అకౌంట్/,
    /ఖాతా/,
    /చిరునామా మార్చ/,
    /అడ్రెస్ మార్చ/,
    /రద్దు/,
  ];

  return privateSupportPatterns.some((pattern) => pattern.test(normalized));
}
