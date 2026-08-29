import type { Json } from "./database";
import type { ProductWithCategory } from "./product";

export type CatalogSourceType = "product" | "store_info" | "faq" | "legal";
export type RetrievalMode = "keyword" | "hybrid" | "assistant";
export type RetrievalStatus = "pending" | "ready" | "failed";
export type GroundedResponseMode = "search_answer" | "assistant_reply";

export interface ProductSearchFilters {
  categoryIds?: string[];
  materials?: string[];
  tags?: string[];
  type?: "sale" | "rental" | "all" | "";
  minPrice?: number;
  maxPrice?: number;
}

export interface ProductSearchHit extends ProductWithCategory {
  sourceType: "product";
  sourceKey: string;
  retrievalStatus: RetrievalStatus;
  score: number;
  keywordRank: number | null;
  semanticRank: number | null;
}

export interface CatalogSearchResponse {
  items: ProductSearchHit[];
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
  mode: Exclude<RetrievalMode, "assistant">;
}

export interface Citation {
  sourceType: CatalogSourceType;
  sourceKey: string;
  title: string;
  productId?: string | null;
  slug?: string | null;
  href?: string | null;
}

export interface CatalogMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Pick<Citation, "sourceKey" | "title">[];
}

export interface RetrievedContextItem {
  sourceType: CatalogSourceType;
  sourceKey: string;
  title: string;
  snippet: string;
  locale: string;
  metadata: Json;
  productId?: string | null;
  slug?: string | null;
  href?: string | null;
  score?: number;
  hit?: ProductSearchHit;
}

export interface RetrievedCatalogContext {
  items: RetrievedContextItem[];
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
  mode: RetrievalMode;
}

export interface GroundedReply {
  answer: string;
  citations: Citation[];
  followUpPrompt: string | null;
}

export type AssistantFallbackReason =
  | "unsupported_scope"
  | "no_context"
  | "generation_error";

export interface AssistantFollowUpSuggestion {
  label: string;
  prompt: string;
  sourceKeys: string[];
}

export interface AssistantPageContext {
  pathname: string;
  product?: {
    slug: string;
    name: string;
  } | null;
  search?: {
    query?: string | null;
    categories?: string[];
  } | null;
  cart?: {
    itemCount: number;
    itemNames: string[];
  } | null;
}

export interface AssistantHandoff {
  type: "whatsapp";
  label: string;
  url: string;
}

export type AssistantNavigationKind =
  | "page"
  | "product_filters"
  | "product_detail"
  | "order_detail"
  | "checkout_confirmation";

export type AssistantNavigationDestination =
  | "home"
  | "products"
  | "search"
  | "cart"
  | "checkout"
  | "wishlist"
  | "account"
  | "orders"
  | "addresses"
  | "about"
  | "visit"
  | "terms"
  | "privacy"
  | "login"
  | "signup"
  | "forgot_password"
  | "product_detail"
  | "order_detail"
  | "checkout_confirmation";

export interface AssistantNavigation {
  kind: AssistantNavigationKind;
  destination: AssistantNavigationDestination;
  /** A validated, locale-neutral internal href. */
  href: string;
}

/** A server-resolved, client-validated route offered when a target is ambiguous. */
export interface AssistantNavigationOption {
  id: string;
  label: string;
  description?: string | null;
  navigation: AssistantNavigation;
}

/** How a navigation-shaped request was resolved. This is telemetry only; the
 * navigation object itself is always independently sanitized on the client. */
export type AssistantNavigationResolution =
  | "deterministic"
  | "dynamic"
  | "grounded"
  | "llm"
  | "miss";

export interface AssistantProductMatch {
  id: string;
  slug: string;
  sourceKey: string;
  name: string;
  name_telugu: string | null;
  primaryImage: string | null;
  categoryName: string | null;
  categoryNameTelugu: string | null;
  isSale: boolean;
  isRental: boolean;
  salePrice: number | null;
  saleOriginalPrice: number | null;
  rentalPrice: number | null;
  rentalOriginalPrice: number | null;
  setNumber: string | null;
}

export interface AssistantReply {
  answer: string;
  citations: Citation[];
  followUpSuggestions: AssistantFollowUpSuggestion[];
  fallbackReason: AssistantFallbackReason | null;
  recommendedProducts?: AssistantProductMatch[];
  navigation?: AssistantNavigation | null;
  navigationOptions?: AssistantNavigationOption[];
  /** Present only for a navigation-shaped request, including a safe miss. */
  navigationResolution?: AssistantNavigationResolution;
}
