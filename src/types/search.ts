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

export interface CatalogMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Citation {
  sourceType: CatalogSourceType;
  sourceKey: string;
  title: string;
  productId?: string | null;
  slug?: string | null;
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
