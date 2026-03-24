import { NextResponse } from "next/server";
import {
  buildAssistantProductSearchQuery,
  buildAssistantSearchFilters,
  buildStarterSuggestions,
  broadenAssistantQuery,
  buildAssistantFallbackReply,
  buildAssistantHandoff,
  buildAssistantIntentReply,
  isUnsupportedAssistantRequest,
  resolveAssistantQuery,
  shouldPreferAssistantPriceAscending,
} from "@/lib/assistant";
import {
  ASSISTANT_CONTEXT_LIMIT,
  ASSISTANT_MAX_ASSISTANT_MESSAGE_CHARS,
  ASSISTANT_MAX_REQUEST_BODY_CHARS,
  ASSISTANT_MAX_TOTAL_MESSAGE_CHARS,
  ASSISTANT_MAX_USER_MESSAGE_CHARS,
  ASSISTANT_RATE_LIMIT_MAX_REQUESTS,
  ASSISTANT_RATE_LIMIT_WINDOW_MS,
  ASSISTANT_REQUEST_WINDOW,
} from "@/lib/assistant-config";
import {
  attachAssistantRecommendedProducts,
  isPolicyOrStoreInfoRequest,
  isProductSeekingAssistantRequest,
} from "@/lib/assistant-product-recommendations";
import { generateAssistantGroundedReply } from "@/lib/retrieval/answer";
import { retrieveCatalogContext } from "@/lib/retrieval/catalog";
import type {
  AssistantPageContext,
  AssistantReply,
  CatalogMessage,
  CatalogSourceType,
  Citation,
  ProductSearchFilters,
  RetrievedContextItem,
} from "@/types/search";

export const runtime = "nodejs";

const MAX_PAGE_CONTEXT_PATH_CHARS = 160;
const MAX_PAGE_CONTEXT_QUERY_CHARS = 180;
const MAX_PAGE_CONTEXT_ITEM_CHARS = 140;
const MAX_PAGE_CONTEXT_CATEGORY_COUNT = 6;
const MAX_PAGE_CONTEXT_CART_ITEMS = 5;

type AssistantRateLimitEntry = {
  count: number;
  resetAt: number;
};

declare global {
  var __assistantChatRateLimitStore:
    | Map<string, AssistantRateLimitEntry>
    | undefined;
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeOptionalText(value: unknown, maxLength: number) {
  const sanitized = sanitizeText(value, maxLength);
  return sanitized || null;
}

function sanitizeStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .flatMap((entry) => {
      const sanitized = sanitizeText(entry, maxLength);
      return sanitized ? [sanitized] : [];
    })
    .slice(0, maxItems);
}

function parseMessages(value: unknown): CatalogMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((message) => {
      if (!message || typeof message !== "object") {
        return [];
      }

      const candidate = message as {
        role?: unknown;
        content?: unknown;
      };

      if (candidate.role !== "user" && candidate.role !== "assistant") {
        return [];
      }

      const role: CatalogMessage["role"] = candidate.role;
      const maxLength =
        role === "assistant"
          ? ASSISTANT_MAX_ASSISTANT_MESSAGE_CHARS
          : ASSISTANT_MAX_USER_MESSAGE_CHARS;
      const content = sanitizeText(candidate.content, maxLength);
      if (!content) {
        return [];
      }

      return [
        {
          role,
          content,
        },
      ];
    })
    .slice(-ASSISTANT_REQUEST_WINDOW);
}

function parsePageContext(value: unknown): AssistantPageContext | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    pathname?: unknown;
    product?: unknown;
    search?: unknown;
    cart?: unknown;
  };
  const pathname = sanitizeOptionalText(
    candidate.pathname,
    MAX_PAGE_CONTEXT_PATH_CHARS
  );

  const productCandidate =
    candidate.product && typeof candidate.product === "object"
      ? (candidate.product as { slug?: unknown; name?: unknown })
      : null;
  const productSlug = sanitizeOptionalText(
    productCandidate?.slug,
    MAX_PAGE_CONTEXT_ITEM_CHARS
  );
  const productName = sanitizeOptionalText(
    productCandidate?.name,
    MAX_PAGE_CONTEXT_ITEM_CHARS
  );

  const searchCandidate =
    candidate.search && typeof candidate.search === "object"
      ? (candidate.search as { query?: unknown; categories?: unknown })
      : null;
  const searchQuery = sanitizeOptionalText(
    searchCandidate?.query,
    MAX_PAGE_CONTEXT_QUERY_CHARS
  );
  const searchCategories = sanitizeStringArray(
    searchCandidate?.categories,
    MAX_PAGE_CONTEXT_CATEGORY_COUNT,
    MAX_PAGE_CONTEXT_ITEM_CHARS
  );

  const cartCandidate =
    candidate.cart && typeof candidate.cart === "object"
      ? (candidate.cart as { itemCount?: unknown; itemNames?: unknown })
      : null;
  const rawItemCount = cartCandidate?.itemCount;
  const itemCount =
    typeof rawItemCount === "number" &&
    Number.isInteger(rawItemCount) &&
    rawItemCount >= 0 &&
    rawItemCount <= 100
      ? rawItemCount
      : null;
  const itemNames = sanitizeStringArray(
    cartCandidate?.itemNames,
    MAX_PAGE_CONTEXT_CART_ITEMS,
    MAX_PAGE_CONTEXT_ITEM_CHARS
  );

  const pageContext: AssistantPageContext = {
    pathname:
      pathname && pathname.startsWith("/")
        ? pathname
        : pathname
          ? `/${pathname.replace(/^\/+/, "")}`
          : "/",
    product:
      productSlug || productName
        ? {
            slug: productSlug ?? "",
            name: productName ?? "",
          }
        : null,
    search:
      searchQuery || searchCategories.length > 0
        ? {
            query: searchQuery,
            categories: searchCategories,
          }
        : null,
    cart:
      itemCount !== null
        ? {
            itemCount,
            itemNames,
          }
        : null,
  };

  return pageContext;
}

function getRateLimitStore() {
  if (!globalThis.__assistantChatRateLimitStore) {
    globalThis.__assistantChatRateLimitStore = new Map();
  }

  return globalThis.__assistantChatRateLimitStore;
}

function getClientIdentifier(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    forwardedIp ??
    "anonymous"
  );
}

function consumeAssistantRateLimit(request: Request) {
  const now = Date.now();
  const store = getRateLimitStore();

  if (store.size > 500) {
    for (const [key, value] of store.entries()) {
      if (value.resetAt <= now) {
        store.delete(key);
      }
    }
  }

  const clientKey = getClientIdentifier(request);
  const existing = store.get(clientKey);

  if (!existing || existing.resetAt <= now) {
    store.set(clientKey, {
      count: 1,
      resetAt: now + ASSISTANT_RATE_LIMIT_WINDOW_MS,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= ASSISTANT_RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000)
      ),
    };
  }

  existing.count += 1;
  store.set(clientKey, existing);

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

function buildSourceTypeMix(sourceTypes: CatalogSourceType[]) {
  return sourceTypes.reduce<Record<CatalogSourceType, number>>(
    (accumulator, sourceType) => {
      accumulator[sourceType] = (accumulator[sourceType] ?? 0) + 1;
      return accumulator;
    },
    {
      product: 0,
      store_info: 0,
      faq: 0,
      legal: 0,
    }
  );
}

function withAssistantRecommendedProducts(args: {
  latestUserMessage: string;
  reply: NonNullable<Awaited<ReturnType<typeof generateAssistantGroundedReply>>["reply"]>;
  pageContext?: AssistantPageContext | null;
  retrievedItems: Awaited<ReturnType<typeof retrieveCatalogContext>>["items"];
}) {
  return attachAssistantRecommendedProducts({
    latestUserMessage: args.latestUserMessage,
    reply: args.reply,
    pageContext: args.pageContext,
    retrievedContext: args.retrievedItems,
  });
}

function mapItemToCitation(item: RetrievedContextItem): Citation {
  return {
    sourceType: item.sourceType,
    sourceKey: item.sourceKey,
    title: item.title,
    productId: item.productId,
    slug: item.slug,
    href: item.href,
  };
}

function hasRetrievedProductHits(items: RetrievedContextItem[]) {
  return items.some((item) => item.sourceType === "product" && Boolean(item.hit));
}

function getComparableAssistantProductPrice(
  item: RetrievedContextItem,
  productType?: ProductSearchFilters["type"]
) {
  if (item.sourceType !== "product" || !item.hit) {
    return Number.POSITIVE_INFINITY;
  }

  if (productType === "rental") {
    return (
      item.hit.rental_discount_price ??
      item.hit.rental_price ??
      Number.POSITIVE_INFINITY
    );
  }

  if (productType === "sale") {
    return item.hit.discount_price ?? item.hit.price ?? Number.POSITIVE_INFINITY;
  }

  if (item.hit.is_rental && !item.hit.is_sale) {
    return (
      item.hit.rental_discount_price ??
      item.hit.rental_price ??
      Number.POSITIVE_INFINITY
    );
  }

  return item.hit.discount_price ?? item.hit.price ?? Number.POSITIVE_INFINITY;
}

function rankAssistantRetrievedItems(args: {
  items: RetrievedContextItem[];
  preferProductsFirst: boolean;
  preferPriceAscending: boolean;
  productType?: ProductSearchFilters["type"];
}) {
  return [...args.items]
    .sort((left, right) => {
      if (args.preferProductsFirst) {
        const productDelta =
          Number(right.sourceType === "product") -
          Number(left.sourceType === "product");
        if (productDelta !== 0) {
          return productDelta;
        }
      }

      if (args.preferPriceAscending) {
        const leftPrice = getComparableAssistantProductPrice(
          left,
          args.productType
        );
        const rightPrice = getComparableAssistantProductPrice(
          right,
          args.productType
        );

        if (Number.isFinite(leftPrice) && Number.isFinite(rightPrice)) {
          if (leftPrice !== rightPrice) {
            return leftPrice - rightPrice;
          }
        } else if (Number.isFinite(leftPrice) !== Number.isFinite(rightPrice)) {
          return Number.isFinite(leftPrice) ? -1 : 1;
        }
      }

      const scoreDelta = (right.score ?? 0) - (left.score ?? 0);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return left.sourceKey.localeCompare(right.sourceKey);
    })
    .slice(0, ASSISTANT_CONTEXT_LIMIT);
}

async function getAssistantRetrievedItems(args: {
  query: string;
  locale: string;
  filters?: ProductSearchFilters;
  isProductQuery: boolean;
  preferPriceAscending: boolean;
  productType?: ProductSearchFilters["type"];
}) {
  if (!args.isProductQuery) {
    const context = await retrieveCatalogContext({
      query: args.query,
      locale: args.locale,
      filters: args.filters,
      limit: ASSISTANT_CONTEXT_LIMIT,
      offset: 0,
      sourceTypes: ["product", "store_info", "faq", "legal"],
      mode: "assistant",
    });

    return rankAssistantRetrievedItems({
      items: context.items,
      preferProductsFirst: false,
      preferPriceAscending: args.preferPriceAscending,
      productType: args.productType,
    });
  }

  const [productContext, publicContext] = await Promise.all([
    retrieveCatalogContext({
      query: args.query,
      locale: args.locale,
      filters: args.filters,
      limit: ASSISTANT_CONTEXT_LIMIT,
      offset: 0,
      sourceTypes: ["product"],
      mode: "assistant",
    }),
    retrieveCatalogContext({
      query: args.query,
      locale: args.locale,
      limit: 3,
      offset: 0,
      sourceTypes: ["store_info", "faq", "legal"],
      mode: "assistant",
    }),
  ]);

  return rankAssistantRetrievedItems({
    items: [...productContext.items, ...publicContext.items],
    preferProductsFirst: true,
    preferPriceAscending: args.preferPriceAscending,
    productType: args.productType,
  });
}

function buildNoProductMatchReply(args: {
  locale: string;
  items: RetrievedContextItem[];
  productType?: ProductSearchFilters["type"];
}): AssistantReply | null {
  if (hasRetrievedProductHits(args.items)) {
    return null;
  }

  const citations = args.items
    .filter((item) => item.sourceType !== "product")
    .slice(0, 2)
    .map(mapItemToCitation);

  if (citations.length === 0) {
    return null;
  }

  const answer =
    args.productType === "rental"
      ? args.locale === "te"
        ? "ప్రస్తుత కాటలాగ్‌లో ధరతో ఉన్న అద్దె ఉత్పత్తులు కనిపించడం లేదు, కాబట్టి ప్రస్తుతం చౌకైన అద్దె ఉత్పత్తిని నేను నిర్ధారించలేను. అయితే అద్దె జ్యువెలరీ మరియు వెడ్డింగ్ సెట్‌ల గురించి స్టోర్ సమాచారం ఉంది."
        : "I couldn't find any live rental products with grounded pricing in the current catalog, so I can't confirm the cheapest rental item right now. I do have store information about rental jewellery and wedding sets."
      : args.locale === "te"
        ? "ఇప్పుడున్న కాటలాగ్‌లో దీనికి సరిపోయే ఉత్పత్తులు కనిపించలేదు. మీరు వర్గం, స్టైల్ లేదా ధర పరిమితితో అడిగితే నేను మరింత కుదించి చూపగలను."
        : "I couldn't find matching products in the current catalog for that right now. If you ask with a category, style, or price range, I can narrow it down more clearly.";

  return {
    answer,
    citations,
    followUpSuggestions: buildStarterSuggestions(args.locale),
    fallbackReason: null,
  };
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const rateLimit = consumeAssistantRateLimit(request);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many assistant requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const contentLength = Number(request.headers.get("content-length"));
    if (
      Number.isFinite(contentLength) &&
      contentLength > ASSISTANT_MAX_REQUEST_BODY_CHARS
    ) {
      return NextResponse.json(
        { error: "Assistant request is too large" },
        { status: 413 }
      );
    }

    const rawBody = await request.text();
    if (rawBody.length > ASSISTANT_MAX_REQUEST_BODY_CHARS) {
      return NextResponse.json(
        { error: "Assistant request is too large" },
        { status: 413 }
      );
    }

    let body: unknown;
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return NextResponse.json(
        { error: "Invalid assistant request body" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid assistant request body" },
        { status: 400 }
      );
    }

    const payload = body as {
      locale?: unknown;
      pageContext?: unknown;
      messages?: unknown;
    };
    const locale = payload.locale === "te" ? "te" : "en";
    const pageContext = parsePageContext(payload.pageContext);
    const messages = parseMessages(payload.messages);
    const totalMessageChars = messages.reduce(
      (sum, message) => sum + message.content.length,
      0
    );

    if (totalMessageChars > ASSISTANT_MAX_TOTAL_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: "Assistant conversation is too large" },
        { status: 413 }
      );
    }

    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user")
      ?.content
      .trim();

    if (!latestUserMessage) {
      return NextResponse.json(
        { error: "At least one user message is required" },
        { status: 400 }
      );
    }

    const handoff = buildAssistantHandoff(latestUserMessage, locale);
    const intentReply = buildAssistantIntentReply(latestUserMessage, locale);
    const productFilters = buildAssistantSearchFilters(latestUserMessage);
    const preferPriceAscending =
      shouldPreferAssistantPriceAscending(latestUserMessage);
    const isProductQuery =
      !isPolicyOrStoreInfoRequest(latestUserMessage) &&
      (Boolean(pageContext?.product?.slug) ||
        isProductSeekingAssistantRequest(latestUserMessage));

    if (intentReply) {
      return NextResponse.json({
        reply: intentReply,
        handoff: null,
      });
    }

    if (isUnsupportedAssistantRequest(latestUserMessage)) {
      return NextResponse.json({
        reply: buildAssistantFallbackReply({
          locale,
          reason: "unsupported_scope",
        }),
        handoff,
      });
    }

    const resolvedQuery = isProductQuery
      ? buildAssistantProductSearchQuery({
          latestUserMessage,
          pageContext,
        })
      : resolveAssistantQuery({ messages, pageContext });
    const firstItems = await getAssistantRetrievedItems({
      query: resolvedQuery,
      locale,
      filters: productFilters,
      isProductQuery,
      preferPriceAscending,
      productType: productFilters?.type,
    });
    const firstAttempt = await generateAssistantGroundedReply({
      messages,
      locale,
      retrievedContext: firstItems,
      pageContext,
    });

    if (firstAttempt.reply) {
      const reply = withAssistantRecommendedProducts({
        latestUserMessage,
        reply: firstAttempt.reply,
        pageContext,
        retrievedItems: firstItems,
      });

      console.info("[assistant.chat]", {
        locale,
        fallbackReason: null,
        retrievalCount: firstItems.length,
        sourceTypeMix: buildSourceTypeMix(
          firstItems.map((item) => item.sourceType)
        ),
        productRecommendationCount: reply.recommendedProducts?.length ?? 0,
        followUpValidationDrops: firstAttempt.meta.droppedFollowUpSuggestions,
        jsonRetryCount: firstAttempt.meta.jsonRetryCount,
        jsonRetryFailed: firstAttempt.meta.jsonRetryFailed,
        latencyMs: Date.now() - startedAt,
      });

      return NextResponse.json({
        reply,
        handoff: null,
      });
    }

    if (firstAttempt.meta.jsonRetryFailed) {
      console.info("[assistant.chat]", {
        locale,
        fallbackReason: "generation_error",
        retrievalCount: firstItems.length,
        sourceTypeMix: buildSourceTypeMix(
          firstItems.map((item) => item.sourceType)
        ),
        followUpValidationDrops: firstAttempt.meta.droppedFollowUpSuggestions,
        jsonRetryCount: firstAttempt.meta.jsonRetryCount,
        jsonRetryFailed: firstAttempt.meta.jsonRetryFailed,
        latencyMs: Date.now() - startedAt,
      });

      return NextResponse.json({
        reply: buildAssistantFallbackReply({
          locale,
          reason: "generation_error",
        }),
        handoff: null,
      });
    }

    const broadenedQuery = isProductQuery
      ? [...new Set([
          buildAssistantProductSearchQuery({
            latestUserMessage,
            pageContext,
          }),
          broadenAssistantQuery({
            latestUserMessage,
            messages,
            pageContext,
          }),
        ].filter(Boolean))]
          .join(", ")
          .trim()
      : broadenAssistantQuery({
          latestUserMessage,
          messages,
          pageContext,
        });

    let finalItemsForFallback = firstItems;

    if (broadenedQuery && broadenedQuery !== resolvedQuery) {
      const secondItems = await getAssistantRetrievedItems({
        query: broadenedQuery,
        locale,
        filters: productFilters,
        isProductQuery,
        preferPriceAscending,
        productType: productFilters?.type,
      });
      finalItemsForFallback = secondItems;
      const secondAttempt = await generateAssistantGroundedReply({
        messages,
        locale,
        retrievedContext: secondItems,
        pageContext,
      });

      if (secondAttempt.reply) {
        const reply = withAssistantRecommendedProducts({
          latestUserMessage,
          reply: secondAttempt.reply,
          pageContext,
          retrievedItems: secondItems,
        });

        console.info("[assistant.chat]", {
          locale,
          fallbackReason: null,
          retrievalCount: secondItems.length,
          sourceTypeMix: buildSourceTypeMix(
            secondItems.map((item) => item.sourceType)
          ),
          productRecommendationCount: reply.recommendedProducts?.length ?? 0,
          followUpValidationDrops:
            firstAttempt.meta.droppedFollowUpSuggestions +
            secondAttempt.meta.droppedFollowUpSuggestions,
          jsonRetryCount:
            firstAttempt.meta.jsonRetryCount + secondAttempt.meta.jsonRetryCount,
          jsonRetryFailed:
            firstAttempt.meta.jsonRetryFailed || secondAttempt.meta.jsonRetryFailed,
          latencyMs: Date.now() - startedAt,
        });

        return NextResponse.json({
          reply,
          handoff: null,
        });
      }

      if (secondAttempt.meta.jsonRetryFailed) {
        console.info("[assistant.chat]", {
          locale,
          fallbackReason: "generation_error",
          retrievalCount: secondItems.length,
          sourceTypeMix: buildSourceTypeMix(
            secondItems.map((item) => item.sourceType)
          ),
          followUpValidationDrops:
            firstAttempt.meta.droppedFollowUpSuggestions +
            secondAttempt.meta.droppedFollowUpSuggestions,
          jsonRetryCount:
            firstAttempt.meta.jsonRetryCount + secondAttempt.meta.jsonRetryCount,
          jsonRetryFailed: true,
          latencyMs: Date.now() - startedAt,
        });

        return NextResponse.json({
          reply: buildAssistantFallbackReply({
            locale,
            reason: "generation_error",
          }),
          handoff: null,
        });
      }

      console.info("[assistant.chat]", {
        locale,
        fallbackReason: "no_context",
        retrievalCount: secondItems.length,
        sourceTypeMix: buildSourceTypeMix(
          secondItems.map((item) => item.sourceType)
        ),
        followUpValidationDrops:
          firstAttempt.meta.droppedFollowUpSuggestions +
          secondAttempt.meta.droppedFollowUpSuggestions,
        jsonRetryCount:
          firstAttempt.meta.jsonRetryCount + secondAttempt.meta.jsonRetryCount,
        jsonRetryFailed: false,
        latencyMs: Date.now() - startedAt,
      });
    } else {
      console.info("[assistant.chat]", {
        locale,
        fallbackReason: "no_context",
        retrievalCount: firstItems.length,
        sourceTypeMix: buildSourceTypeMix(
          firstItems.map((item) => item.sourceType)
        ),
        followUpValidationDrops: firstAttempt.meta.droppedFollowUpSuggestions,
        jsonRetryCount: firstAttempt.meta.jsonRetryCount,
        jsonRetryFailed: false,
        latencyMs: Date.now() - startedAt,
      });
    }

    const noProductMatchReply = isProductQuery
      ? buildNoProductMatchReply({
          locale,
          items: finalItemsForFallback,
          productType: productFilters?.type,
        })
      : null;

    if (noProductMatchReply) {
      console.info("[assistant.chat]", {
        locale,
        fallbackReason: null,
        retrievalCount: finalItemsForFallback.length,
        sourceTypeMix: buildSourceTypeMix(
          finalItemsForFallback.map((item) => item.sourceType)
        ),
        productRecommendationCount: 0,
        followUpValidationDrops: firstAttempt.meta.droppedFollowUpSuggestions,
        jsonRetryCount: firstAttempt.meta.jsonRetryCount,
        jsonRetryFailed: false,
        latencyMs: Date.now() - startedAt,
      });

      return NextResponse.json({
        reply: noProductMatchReply,
        handoff: null,
      });
    }

    return NextResponse.json({
      reply: buildAssistantFallbackReply({
        locale,
        reason: "no_context",
      }),
      handoff: null,
    });
  } catch (error) {
    console.error("Assistant chat API error:", error);
    return NextResponse.json(
      { error: "Could not generate an assistant reply" },
      { status: 500 }
    );
  }
}
