export type AssistantLanguage = "en" | "te";

const ROMANIZED_TELUGU_WORDS =
  /\b(andi|meeru|nenu|naaku|naku|emi|em|unnayi|undhi|undi|kavali|kaavali|chupinchandi|choopinchandi|bangaram|vaddanam|haram|nannu|teesukellandi|teeskellandi|tisukellandi|vellandi|velandi)\b/i;

const ENGLISH_SIGNAL_WORDS = new Set([
  "a",
  "an",
  "about",
  "account",
  "address",
  "and",
  "are",
  "available",
  "availability",
  "bangle",
  "bangles",
  "browse",
  "bracelet",
  "bracelets",
  "buy",
  "can",
  "cart",
  "chain",
  "chains",
  "checkout",
  "collection",
  "cost",
  "conditions",
  "could",
  "did",
  "do",
  "does",
  "earring",
  "earrings",
  "find",
  "go",
  "gold",
  "has",
  "have",
  "hello",
  "help",
  "hi",
  "home",
  "how",
  "i",
  "is",
  "jewellery",
  "jewelry",
  "looking",
  "me",
  "much",
  "my",
  "navigate",
  "necklace",
  "necklaces",
  "open",
  "orders",
  "page",
  "pendant",
  "pendants",
  "please",
  "policy",
  "price",
  "privacy",
  "product",
  "products",
  "rent",
  "rental",
  "ring",
  "rings",
  "sale",
  "search",
  "sell",
  "set",
  "sets",
  "show",
  "take",
  "terms",
  "the",
  "to",
  "under",
  "visit",
  "want",
  "wedding",
  "what",
  "where",
  "wishlist",
  "with",
  "would",
  "you",
  "your",
]);

// V1 only guarantees English and Telugu. These common signals keep familiar
// Romanized Hindi requests from being mistaken for English merely because both
// languages use the Latin alphabet in a transcript.
const UNSUPPORTED_ROMANIZED_LANGUAGE_WORDS =
  /\b(aap|chalo|dikhao|hai|hain|jao|jana|karo|karna|ko|kripya|le|mujhe|mujhko|pe|tum|yaar)\b/i;

export function hasTeluguScript(value: string) {
  return /[\u0C00-\u0C7F]/.test(value);
}

export function isLikelyRomanizedTelugu(value: string) {
  return ROMANIZED_TELUGU_WORDS.test(value);
}

export function isLikelyEnglish(value: string) {
  if (!/\p{Script=Latin}/u.test(value) || UNSUPPORTED_ROMANIZED_LANGUAGE_WORDS.test(value)) {
    return false;
  }

  const words = value.toLowerCase().match(/\p{L}+/gu) ?? [];
  const englishSignals = words.filter((word) => ENGLISH_SIGNAL_WORDS.has(word));

  return englishSignals.length >= 2 || (words.length <= 2 && englishSignals.length > 0);
}

/**
 * The storefront supports English and Telugu. Telugu is recognised from its
 * script or a small, deliberately conservative Romanized Telugu vocabulary.
 * English must have positive language signals; unsupported input falls back to
 * the customer’s selected storefront locale.
 */
export function detectAssistantLanguage(
  value: string,
  fallbackLocale: string,
): AssistantLanguage {
  const fallback: AssistantLanguage = fallbackLocale === "te" ? "te" : "en";

  if (hasTeluguScript(value) || isLikelyRomanizedTelugu(value)) {
    return "te";
  }

  if (isLikelyEnglish(value)) {
    return "en";
  }

  return fallback;
}
