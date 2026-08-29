import { sanitizeAssistantNavigation } from "@/lib/assistant-navigation";
import {
  ASSISTANT_ROUTE_ALLOWED_ANCHORS,
  getAssistantRouteManifest,
  isAssistantRouteAnchorAllowed,
  serializeAssistantRoute,
} from "@/lib/assistant-route-manifest";
import type {
  AssistantNavigation,
  AssistantNavigationOption,
  AssistantPageContext,
  RetrievedContextItem,
} from "@/types/search";

const MAX_RETRIEVED_CONTEXT_ITEMS = 12;
const MAX_GROUNDED_NAVIGATION_CANDIDATES = 3;
const MAX_CANDIDATE_ID_LENGTH = 120;
const MAX_CANDIDATE_DISPLAY_LENGTH = 180;
const PRODUCT_OR_CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_SOURCE_KEY_PATTERN = /^[a-z0-9:_-]+$/i;

/**
 * Re-export the route-owned anchor allow-list for retrieval consumers. The
 * grounding layer does not own anchors and never trusts raw document hashes.
 */
export { ASSISTANT_ROUTE_ALLOWED_ANCHORS as ASSISTANT_GROUNDED_NAVIGATION_ALLOWED_ANCHORS } from "@/lib/assistant-route-manifest";

export type AssistantGroundedNavigationCandidateType =
  | "product"
  | "category"
  | "policy"
  | "page";

/** A candidate built from retrieval output, never from a model-provided URL. */
export interface AssistantGroundedNavigationCandidate {
  id: string;
  type: AssistantGroundedNavigationCandidateType;
  sourceKey: string;
  label: string;
  description: string | null;
  navigation: AssistantNavigation;
}

/** `undefined` means use safe ambiguity behavior; `null` means no navigation. */
export interface AssistantGroundedNavigationSelection {
  candidateId: string | null;
}

export interface AssistantGroundedNavigationRequest {
  query: string;
  locale: string;
  retrievedContext: readonly RetrievedContextItem[];
  /**
   * A structured model may choose only a candidate ID supplied by
   * `buildAssistantGroundedNavigationCandidates`. It never supplies an href.
   */
  selection?: AssistantGroundedNavigationSelection | null;
  /** Used only to rank an already-retrieved product; it cannot create a route. */
  pageContext?: Pick<AssistantPageContext, "pathname" | "product"> | null;
}

export type AssistantGroundedNavigationResolution =
  | {
      type: "navigation";
      candidate: AssistantGroundedNavigationCandidate;
      navigation: AssistantNavigation;
    }
  | {
      type: "options";
      candidates: AssistantGroundedNavigationCandidate[];
      options: AssistantNavigationOption[];
    }
  | null;

type RankedCandidate = AssistantGroundedNavigationCandidate & {
  relevance: number;
  retrievalRank: number;
  localeMatch: boolean;
  pageContextMatch: boolean;
};

function isValidSlug(value: string | null | undefined) {
  return Boolean(value && PRODUCT_OR_CATEGORY_SLUG_PATTERN.test(value));
}

function isSafeCandidateSourceKey(value: string) {
  return (
    value.length > 0 &&
    value.length <= MAX_CANDIDATE_ID_LENGTH - 12 &&
    SAFE_SOURCE_KEY_PATTERN.test(value)
  );
}

function toCandidateId(type: AssistantGroundedNavigationCandidateType, sourceKey: string) {
  if (!isSafeCandidateSourceKey(sourceKey)) return null;

  const id = `${type}:${sourceKey}`;
  return id.length <= MAX_CANDIDATE_ID_LENGTH ? id : null;
}

function toDisplayText(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return (
    text.length > 0 &&
    text.length <= MAX_CANDIDATE_DISPLAY_LENGTH &&
    !/[\u0000-\u001F\u007F]/.test(text)
  )
    ? text
    : null;
}

function localizedProductLabel(item: RetrievedContextItem, locale: string) {
  if (!item.hit) return null;
  const label = locale === "te" && item.hit.name_telugu
    ? item.hit.name_telugu
    : item.hit.name;
  return toDisplayText(label);
}

function localizedCategoryLabel(item: RetrievedContextItem, locale: string) {
  if (!item.hit?.category) return null;
  const label = locale === "te" && item.hit.category.name_telugu
    ? item.hit.category.name_telugu
    : item.hit.category.name;
  return toDisplayText(label);
}

function productNavigation(slug: string) {
  if (!isValidSlug(slug)) return null;
  return sanitizeAssistantNavigation(
    serializeAssistantRoute("product_detail", { slug }),
  );
}

function categoryNavigation(slug: string) {
  if (!isValidSlug(slug)) return null;
  return sanitizeAssistantNavigation(
    serializeAssistantRoute("products", { category: slug }),
  );
}

function parseRetrievedInternalHref(value: string) {
  if (
    value.length === 0 ||
    value.length > 300 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("..") ||
    /%2e/i.test(value)
  ) {
    return null;
  }

  try {
    const url = new URL(value, "https://assistant.local");
    return url.origin === "https://assistant.local" ? url : null;
  } catch {
    return null;
  }
}

function getStaticRouteForPath(pathname: string) {
  return getAssistantRouteManifest({ includeEntityRoutes: false }).find((route) => {
    if (route.entityResolution !== "none") return false;
    return serializeAssistantRoute(route.id, {})?.href === pathname;
  }) ?? null;
}

/**
 * Convert an href already attached to a retrieved public document into a
 * navigation payload. A matching path is canonicalised through the route
 * manifest; an unknown path, query, or hash cannot be used as a target.
 */
function staticNavigationFromRetrievedHref(href: string) {
  const url = parseRetrievedInternalHref(href);
  if (!url || url.search) return null;

  const route = getStaticRouteForPath(url.pathname);
  if (!route) return null;

  const anchor = url.hash ? url.hash.slice(1) : null;
  if (anchor && !isAssistantRouteAnchorAllowed(route.id, anchor)) return null;

  const navigation = serializeAssistantRoute(
    route.id,
    anchor ? { anchor } : {},
  );
  if (!navigation || navigation.href !== `${url.pathname}${url.hash}`) return null;

  // Before a transport sanitizer opts into route-owned anchors, preserve the
  // useful base-page destination rather than treating an otherwise grounded
  // policy hit as a miss. Once it accepts the manifest anchor, the first
  // branch keeps the precise section automatically.
  return (
    sanitizeAssistantNavigation(navigation) ??
    sanitizeAssistantNavigation(serializeAssistantRoute(route.id, {}))
  );
}

function normalizedTerms(value: string) {
  return value
    .slice(0, 1_024)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((term) => term.length > 1)
    .slice(0, 24);
}

function getRelevance(query: string, candidate: AssistantGroundedNavigationCandidate) {
  const terms = normalizedTerms(query);
  if (terms.length === 0) return 0;

  const haystack = [candidate.label, candidate.description, candidate.sourceKey]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();

  return terms.reduce((score, term) => score + Number(haystack.includes(term)), 0);
}

function isCategoryMentioned(query: string, label: string, slug: string) {
  const normalizedQuery = normalizedTerms(query).join(" ");
  const normalizedLabel = normalizedTerms(label).join(" ");
  const normalizedSlug = normalizedTerms(slug.replace(/-/g, " ")).join(" ");

  return (
    Boolean(normalizedLabel && normalizedQuery.includes(normalizedLabel)) ||
    Boolean(normalizedSlug && normalizedQuery.includes(normalizedSlug))
  );
}

function getPageContextProductSlug(
  pageContext: AssistantGroundedNavigationRequest["pageContext"],
) {
  const slug = pageContext?.product?.slug;
  return typeof slug === "string" && isValidSlug(slug) ? slug : null;
}

/**
 * Retrieval always includes a small amount of seed context. Do not let that
 * baseline turn an otherwise vague navigation request into a random page
 * jump: a candidate must name something in the request, unless it is the
 * explicitly supplied current product.
 */
function isCandidateRelevantToRequest(
  query: string,
  candidate: AssistantGroundedNavigationCandidate,
  pageContext: AssistantGroundedNavigationRequest["pageContext"],
) {
  if (getRelevance(query, candidate) > 0) return true;

  const pageContextProductSlug = getPageContextProductSlug(pageContext);
  return (
    candidate.type === "product" &&
    pageContextProductSlug !== null &&
    candidate.id === `product:${pageContextProductSlug}`
  );
}

function toOption(candidate: AssistantGroundedNavigationCandidate): AssistantNavigationOption {
  return {
    id: candidate.id,
    label: candidate.label,
    description: candidate.description,
    navigation: candidate.navigation,
  };
}

function pushCandidate(
  candidates: RankedCandidate[],
  candidate: AssistantGroundedNavigationCandidate,
  args: {
    query: string;
    locale: string;
    retrievalRank: number;
    sourceLocale: string;
    pageContextProductSlug: string | null;
  },
) {
  if (candidates.some((existing) => existing.navigation.href === candidate.navigation.href)) {
    return;
  }

  const productSlug = candidate.type === "product"
    ? candidate.id.slice("product:".length)
    : null;

  candidates.push({
    ...candidate,
    relevance: getRelevance(args.query, candidate),
    retrievalRank: args.retrievalRank,
    localeMatch: args.sourceLocale === args.locale,
    pageContextMatch: productSlug === args.pageContextProductSlug,
  });
}

/**
 * Produces a short, safe candidate menu from already-retrieved data. This is
 * suitable for putting in a structured-output prompt: the model may select an
 * `id`, but cannot create a URL, slug, category, or document reference.
 */
export function buildAssistantGroundedNavigationCandidates(
  args: Omit<AssistantGroundedNavigationRequest, "selection">,
): AssistantGroundedNavigationCandidate[] {
  const candidates: RankedCandidate[] = [];
  const pageContextProductSlug = getPageContextProductSlug(args.pageContext);

  for (const [retrievalRank, item] of args.retrievedContext
    .slice(0, MAX_RETRIEVED_CONTEXT_ITEMS)
    .entries()) {
    const candidateArgs = {
      query: args.query,
      locale: args.locale,
      retrievalRank,
      sourceLocale: item.locale,
      pageContextProductSlug,
    };

    if (item.sourceType === "product") {
      const label = localizedProductLabel(item, args.locale);
      const navigation = productNavigation(item.slug ?? "");
      const id = toCandidateId("product", item.slug ?? "");
      if (label && navigation && id) {
        pushCandidate(
          candidates,
          {
            id,
            type: "product",
            sourceKey: item.sourceKey,
            label,
            description: item.hit?.category
              ? localizedCategoryLabel(item, args.locale)
              : null,
            navigation,
          },
          candidateArgs,
        );
      }

      const category = item.hit?.category;
      const categoryLabel = localizedCategoryLabel(item, args.locale);
      const categorySlug = category?.slug ?? "";
      const categoryTarget = categoryNavigation(categorySlug);
      const categoryId = toCandidateId("category", categorySlug);
      if (
        categoryLabel &&
        categoryTarget &&
        categoryId &&
        isCategoryMentioned(args.query, categoryLabel, categorySlug)
      ) {
        pushCandidate(
          candidates,
          {
            id: categoryId,
            type: "category",
            sourceKey: `category:${categorySlug}`,
            label: categoryLabel,
            description:
              args.locale === "te" ? "ఉత్పత్తి వర్గం" : "Product category",
            navigation: categoryTarget,
          },
          candidateArgs,
        );
      }

      continue;
    }

    if (
      (item.sourceType === "legal" || item.sourceType === "faq" || item.sourceType === "store_info") &&
      item.href
    ) {
      const navigation = staticNavigationFromRetrievedHref(item.href);
      const type = item.sourceType === "legal" ? "policy" : "page";
      const id = toCandidateId(type, item.sourceKey);
      const label = toDisplayText(item.title);
      if (navigation && id && label) {
        pushCandidate(
          candidates,
          {
            id,
            type,
            sourceKey: item.sourceKey,
            label,
            description:
              item.sourceType === "legal"
                ? args.locale === "te"
                  ? "విధాన విభాగం"
                  : "Policy section"
                : null,
            navigation,
          },
          candidateArgs,
        );
      }
    }
  }

  return candidates
    .sort((left, right) => {
      if (right.relevance !== left.relevance) {
        return right.relevance - left.relevance;
      }
      if (right.pageContextMatch !== left.pageContextMatch) {
        return Number(right.pageContextMatch) - Number(left.pageContextMatch);
      }
      if (right.localeMatch !== left.localeMatch) {
        return Number(right.localeMatch) - Number(left.localeMatch);
      }
      return left.retrievalRank - right.retrievalRank;
    })
    .slice(0, MAX_GROUNDED_NAVIGATION_CANDIDATES)
    .map(({ relevance: _relevance, retrievalRank: _rank, localeMatch: _locale, pageContextMatch: _page, ...candidate }) => candidate);
}

function getExplicitSelectionId(selection: AssistantGroundedNavigationRequest["selection"]) {
  if (!selection || typeof selection !== "object") return null;
  const candidateId = selection.candidateId;
  return typeof candidateId === "string" && candidateId.length <= MAX_CANDIDATE_ID_LENGTH
    ? candidateId
    : null;
}

/**
 * Resolves a selected retrieval candidate into a validated navigation payload.
 * When no model selection is supplied, multiple candidates remain choices
 * instead of being guessed. Passing `selection: null` explicitly disables
 * navigation for the request.
 */
export function resolveAssistantGroundedNavigation(
  args: AssistantGroundedNavigationRequest,
): AssistantGroundedNavigationResolution {
  const candidates = buildAssistantGroundedNavigationCandidates({
    query: args.query,
    locale: args.locale,
    retrievedContext: args.retrievedContext,
    pageContext: args.pageContext,
  }).filter((candidate) =>
    isCandidateRelevantToRequest(args.query, candidate, args.pageContext),
  );

  if (args.selection !== undefined) {
    const selectedId = getExplicitSelectionId(args.selection);
    if (!selectedId) return null;

    const candidate = candidates.find((entry) => entry.id === selectedId);
    return candidate
      ? { type: "navigation", candidate, navigation: candidate.navigation }
      : null;
  }

  if (candidates.length === 1) {
    const candidate = candidates[0];
    return { type: "navigation", candidate, navigation: candidate.navigation };
  }

  return candidates.length > 1
    ? {
        type: "options",
        candidates,
        options: candidates.map(toOption),
      }
    : null;
}
