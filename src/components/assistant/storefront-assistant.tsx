"use client";

import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { AssistantProductCard } from "@/components/assistant/assistant-product-card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/hooks/use-cart";
import {
  ASSISTANT_MAX_ASSISTANT_MESSAGE_CHARS,
  ASSISTANT_MAX_USER_MESSAGE_CHARS,
  ASSISTANT_REQUEST_WINDOW,
  ASSISTANT_STORAGE_MAX_CHARS,
  ASSISTANT_STORAGE_MAX_ENTRIES,
} from "@/lib/assistant-config";
import { trackEvent } from "@/lib/gtag";
import { Link, usePathname } from "@/i18n/routing";
import type {
  AssistantHandoff,
  AssistantPageContext,
  AssistantProductMatch,
  AssistantReply,
  AssistantFollowUpSuggestion,
  CatalogMessage,
  Citation,
} from "@/types/search";
import { Bot, Loader2, MessageCircle, Send, Sparkles, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

interface AssistantConversationEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "pending" | "ready" | "failed";
  citations?: Citation[];
  recommendedProducts?: AssistantProductMatch[];
  followUpSuggestions?: AssistantFollowUpSuggestion[];
  handoff?: AssistantHandoff | null;
  errorMessage?: string | null;
}

interface StoredAssistantConversation {
  version: number;
  conversation: AssistantConversationEntry[];
}

const ASSISTANT_STORAGE_KEY = "bfg-storefront-assistant-session";
const ASSISTANT_STORAGE_VERSION = 3;

function generateEntryId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeEntryText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizePrice(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function sanitizeRecommendedProducts(
  value: unknown
): AssistantProductMatch[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .flatMap((product) => {
      if (!product || typeof product !== "object") {
        return [];
      }

      const item = product as Partial<AssistantProductMatch>;
      const id = sanitizeEntryText(item.id, 120);
      const slug = sanitizeEntryText(item.slug, 180);
      const sourceKey = sanitizeEntryText(item.sourceKey, 120);
      const name = sanitizeEntryText(item.name, 180);

      if (!id || !slug || !sourceKey || !name) {
        return [];
      }

      return [
        {
          id,
          slug,
          sourceKey,
          name,
          name_telugu:
            typeof item.name_telugu === "string"
              ? sanitizeEntryText(item.name_telugu, 180)
              : null,
          primaryImage:
            typeof item.primaryImage === "string"
              ? sanitizeEntryText(item.primaryImage, 500)
              : null,
          categoryName:
            typeof item.categoryName === "string"
              ? sanitizeEntryText(item.categoryName, 120)
              : null,
          categoryNameTelugu:
            typeof item.categoryNameTelugu === "string"
              ? sanitizeEntryText(item.categoryNameTelugu, 120)
              : null,
          isSale: Boolean(item.isSale),
          isRental: Boolean(item.isRental),
          salePrice: sanitizePrice(item.salePrice),
          saleOriginalPrice: sanitizePrice(item.saleOriginalPrice),
          rentalPrice: sanitizePrice(item.rentalPrice),
          rentalOriginalPrice: sanitizePrice(item.rentalOriginalPrice),
          setNumber:
            typeof item.setNumber === "string"
              ? sanitizeEntryText(item.setNumber, 80)
              : null,
        },
      ];
    })
    .slice(0, 3);

  return items.length > 0 ? items : undefined;
}

function sanitizeStoredEntry(entry: unknown): AssistantConversationEntry | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const candidate = entry as Partial<AssistantConversationEntry>;
  if (candidate.role !== "user" && candidate.role !== "assistant") {
    return null;
  }

  const maxLength =
    candidate.role === "assistant"
      ? ASSISTANT_MAX_ASSISTANT_MESSAGE_CHARS
      : ASSISTANT_MAX_USER_MESSAGE_CHARS;
  const content = sanitizeEntryText(candidate.content, maxLength);
  if (!content && candidate.role === "user") {
    return null;
  }

  const citations = Array.isArray(candidate.citations)
    ? candidate.citations
        .flatMap((citation) => {
          if (!citation || typeof citation !== "object") {
            return [];
          }

          const item = citation as Citation;
          const sourceKey = sanitizeEntryText(item.sourceKey, 120);
          const title = sanitizeEntryText(item.title, 180);

          if (!sourceKey || !title) {
            return [];
          }

          return [
            {
              sourceType: item.sourceType,
              sourceKey,
              title,
              productId:
                typeof item.productId === "string"
                  ? sanitizeEntryText(item.productId, 120)
                  : null,
              slug:
                typeof item.slug === "string"
                  ? sanitizeEntryText(item.slug, 180)
                  : null,
              href:
                typeof item.href === "string"
                  ? sanitizeEntryText(item.href, 240)
                  : null,
            },
          ];
        })
        .slice(0, 6)
    : undefined;

  const followUpSuggestions = Array.isArray(candidate.followUpSuggestions)
    ? candidate.followUpSuggestions
        .flatMap((suggestion) => {
          if (!suggestion || typeof suggestion !== "object") {
            return [];
          }

          const item = suggestion as AssistantFollowUpSuggestion;
          const label = sanitizeEntryText(item.label, 140);
          const prompt = sanitizeEntryText(
            item.prompt,
            ASSISTANT_MAX_USER_MESSAGE_CHARS
          );
          const sourceKeys = Array.isArray(item.sourceKeys)
            ? item.sourceKeys
                .map((sourceKey) => sanitizeEntryText(sourceKey, 120))
                .filter(Boolean)
                .slice(0, 3)
            : [];

          if (!label || !prompt) {
            return [];
          }

          return [{ label, prompt, sourceKeys }];
        })
        .slice(0, 3)
    : undefined;
  const recommendedProducts = sanitizeRecommendedProducts(
    candidate.recommendedProducts
  );

  return {
    id: sanitizeEntryText(candidate.id, 120) || generateEntryId(),
    role: candidate.role,
    content,
    status:
      candidate.status === "failed"
        ? "failed"
        : candidate.status === "pending"
          ? "failed"
          : "ready",
    citations,
    recommendedProducts,
    followUpSuggestions,
    handoff:
      candidate.handoff &&
      typeof candidate.handoff === "object" &&
      candidate.handoff.type === "whatsapp"
        ? {
            type: "whatsapp",
            label: sanitizeEntryText(candidate.handoff.label, 80),
            url: sanitizeEntryText(candidate.handoff.url, 320),
          }
        : null,
    errorMessage:
      typeof candidate.errorMessage === "string"
        ? sanitizeEntryText(candidate.errorMessage, 180)
        : null,
  };
}

function trimConversationForStorage(entries: AssistantConversationEntry[]) {
  return entries
    .map((entry) => sanitizeStoredEntry(entry))
    .filter((entry): entry is AssistantConversationEntry => Boolean(entry))
    .slice(-ASSISTANT_STORAGE_MAX_ENTRIES);
}

function storeConversation(entries: AssistantConversationEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  const trimmedConversation = trimConversationForStorage(entries);
  if (trimmedConversation.length === 0) {
    window.sessionStorage.removeItem(ASSISTANT_STORAGE_KEY);
    return;
  }

  for (let startIndex = 0; startIndex < trimmedConversation.length; startIndex += 1) {
    const candidateConversation = trimmedConversation.slice(startIndex);
    const payload = JSON.stringify({
      version: ASSISTANT_STORAGE_VERSION,
      conversation: candidateConversation,
    } satisfies StoredAssistantConversation);

    if (payload.length > ASSISTANT_STORAGE_MAX_CHARS) {
      continue;
    }

    try {
      window.sessionStorage.setItem(ASSISTANT_STORAGE_KEY, payload);
      return;
    } catch {
      continue;
    }
  }

  window.sessionStorage.removeItem(ASSISTANT_STORAGE_KEY);
}

function loadStoredConversation() {
  if (typeof window === "undefined") {
    return [] as AssistantConversationEntry[];
  }

  try {
    const stored = window.sessionStorage.getItem(ASSISTANT_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("version" in parsed) ||
      (parsed as StoredAssistantConversation).version !== ASSISTANT_STORAGE_VERSION ||
      !Array.isArray((parsed as StoredAssistantConversation).conversation)
    ) {
      return [];
    }

    return trimConversationForStorage(
      (parsed as StoredAssistantConversation).conversation
    );
  } catch {
    return [];
  }
}

function mapConversationToMessages(
  entries: AssistantConversationEntry[]
): CatalogMessage[] {
  return entries.map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));
}

function buildRequestMessages(entries: AssistantConversationEntry[]) {
  return mapConversationToMessages(entries.slice(-ASSISTANT_REQUEST_WINDOW));
}

function normalizeFollowUpSuggestions(
  reply: AssistantReply
): AssistantFollowUpSuggestion[] {
  return reply.followUpSuggestions.filter(
    (suggestion) =>
      typeof suggestion.label === "string" &&
      suggestion.label.trim().length > 0 &&
      typeof suggestion.prompt === "string" &&
      suggestion.prompt.trim().length > 0 &&
      Array.isArray(suggestion.sourceKeys)
  );
}

function normalizeRecommendedProducts(reply: AssistantReply) {
  return sanitizeRecommendedProducts(reply.recommendedProducts) ?? [];
}

export function StorefrontAssistant() {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("assistant");
  const { items: cartItems, itemCount } = useCart();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [conversation, setConversation] = useState<AssistantConversationEntry[]>(
    () => loadStoredConversation()
  );
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const conversationRef = useRef(conversation);
  const isSendingRef = useRef(false);

  const shouldHide =
    pathname.startsWith("/account") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");
  const starterPrompts = useMemo(
    () => [
      t("starterPrompts.discovery"),
      t("starterPrompts.rental"),
      t("starterPrompts.budget"),
      t("starterPrompts.policy"),
    ],
    [t]
  );

  useEffect(() => {
    conversationRef.current = conversation;
    storeConversation(conversation);
  }, [conversation]);

  useEffect(() => {
    isSendingRef.current = isSending;
  }, [isSending]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [conversation, isSending, open]);

  if (shouldHide) {
    return null;
  }

  function buildPageContext(): AssistantPageContext {
    const productMarker = document.querySelector<HTMLElement>(
      "[data-assistant-product-slug]"
    );
    const searchQuery = searchParams.get("q") ?? searchParams.get("search");
    const categories = searchParams.getAll("category");

    return {
      pathname,
      product: productMarker
        ? {
            slug: productMarker.dataset.assistantProductSlug ?? "",
            name: productMarker.dataset.assistantProductName ?? "",
          }
        : null,
      search:
        searchQuery || categories.length > 0
          ? {
              query: searchQuery,
              categories,
            }
          : null,
      cart:
        pathname.startsWith("/cart") || pathname.startsWith("/checkout")
          ? {
              itemCount,
              itemNames: cartItems.map((item) =>
                locale === "te" && item.product.name_telugu
                  ? item.product.name_telugu
                  : item.product.name
              ),
            }
          : null,
    };
  }

  function updateConversation(
    updater: (current: AssistantConversationEntry[]) => AssistantConversationEntry[]
  ) {
    setConversation((current) => {
      const next = updater(current);
      conversationRef.current = next;
      return next;
    });
  }

  async function openHandoff(url: string) {
    trackEvent("assistant_handoff_click", { pathname, locale });

    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url });
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function sendMessage(rawMessage?: string) {
    const nextInput = sanitizeEntryText(
      rawMessage ?? input,
      ASSISTANT_MAX_USER_MESSAGE_CHARS
    );
    if (!nextInput || isSendingRef.current) {
      return;
    }

    isSendingRef.current = true;
    setIsSending(true);

    const userEntryId = generateEntryId();
    const assistantEntryId = generateEntryId();
    const userEntry: AssistantConversationEntry = {
      id: userEntryId,
      role: "user",
      content: nextInput,
      status: "ready",
    };
    const assistantEntry: AssistantConversationEntry = {
      id: assistantEntryId,
      role: "assistant",
      content: "",
      status: "pending",
    };
    const nextConversation = [...conversationRef.current, userEntry];
    const requestMessages = buildRequestMessages(nextConversation);
    const pendingConversation = [...nextConversation, assistantEntry];

    conversationRef.current = pendingConversation;
    setConversation(pendingConversation);
    setInput("");
    setOpen(true);
    trackEvent("assistant_message_sent", { pathname, locale });

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          messages: requestMessages,
          pageContext: buildPageContext(),
        }),
      });

      if (!response.ok) {
        throw new Error("Assistant request failed");
      }

      const data = (await response.json()) as {
        reply: AssistantReply | null;
        handoff: AssistantHandoff | null;
      };

      const reply = data.reply;
      if (!reply) {
        throw new Error("Assistant reply missing");
      }
      const recommendedProducts = normalizeRecommendedProducts(reply);
      if (recommendedProducts.length > 0) {
        trackEvent("assistant_product_impression", {
          pathname,
          locale,
          product_count: recommendedProducts.length,
        });
      }

      updateConversation((current) =>
        current.map((entry) =>
          entry.id === assistantEntryId
            ? {
                ...entry,
                content: reply.answer,
                status: "ready",
                citations: reply.citations,
                recommendedProducts:
                  recommendedProducts.length > 0
                    ? recommendedProducts
                    : undefined,
                followUpSuggestions: normalizeFollowUpSuggestions(reply),
                handoff: data.handoff,
                errorMessage: null,
              }
            : entry
        )
      );
    } catch {
      updateConversation((current) =>
        current.map((entry) =>
          entry.id === assistantEntryId
            ? {
                ...entry,
                content: t("error"),
                status: "failed",
                errorMessage: t("error"),
                handoff: null,
              }
            : entry
        )
      );
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }

  async function retryAssistantEntry(entryId: string) {
    if (isSendingRef.current) {
      return;
    }

    const currentConversation = conversationRef.current;
    const entryIndex = currentConversation.findIndex((entry) => entry.id === entryId);
    if (entryIndex === -1) {
      return;
    }

    const entry = currentConversation[entryIndex];
    if (entry.role !== "assistant" || entry.status !== "failed") {
      return;
    }

    const messagesBeforeRetry = currentConversation.slice(0, entryIndex);
    if (messagesBeforeRetry.length === 0) {
      return;
    }

    isSendingRef.current = true;
    updateConversation((current) =>
      current.map((item) =>
        item.id === entryId
          ? {
              ...item,
              status: "pending",
              content: "",
              errorMessage: null,
            }
          : item
      )
    );

    setIsSending(true);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          messages: buildRequestMessages(messagesBeforeRetry),
          pageContext: buildPageContext(),
        }),
      });

      if (!response.ok) {
        throw new Error("Assistant request failed");
      }

      const data = (await response.json()) as {
        reply: AssistantReply | null;
        handoff: AssistantHandoff | null;
      };

      if (!data.reply) {
        throw new Error("Assistant reply missing");
      }

      const reply = data.reply;
      const recommendedProducts = normalizeRecommendedProducts(reply);
      if (recommendedProducts.length > 0) {
        trackEvent("assistant_product_impression", {
          pathname,
          locale,
          product_count: recommendedProducts.length,
        });
      }

      updateConversation((current) =>
        current.map((item) =>
          item.id === entryId
            ? {
                ...item,
                content: reply.answer,
                status: "ready",
                citations: reply.citations,
                recommendedProducts:
                  recommendedProducts.length > 0
                    ? recommendedProducts
                    : undefined,
                followUpSuggestions: normalizeFollowUpSuggestions(reply),
                handoff: data.handoff,
                errorMessage: null,
              }
            : item
        )
      );
    } catch {
      updateConversation((current) =>
        current.map((item) =>
          item.id === entryId
            ? {
                ...item,
                content: t("error"),
                status: "failed",
                errorMessage: t("error"),
              }
            : item
        )
      );
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !open) {
      trackEvent("assistant_open", { pathname, locale });
    }
    setOpen(nextOpen);
  }

  function handleCitationClick(citation: Citation) {
    trackEvent("assistant_citation_click", {
      source_type: citation.sourceType,
    });
    setOpen(false);
  }

  function handleProductClick(
    entry: AssistantConversationEntry,
    product: AssistantProductMatch
  ) {
    trackEvent("assistant_product_click", {
      pathname,
      locale,
      product_count: entry.recommendedProducts?.length ?? 0,
      product_slug: product.slug,
    });
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        aria-label={t("launcherLabel")}
        data-testid="assistant-launcher"
        className="fixed bottom-24 right-4 z-40 rounded-full px-4 shadow-lg lg:bottom-6 lg:right-6"
        onClick={() => handleOpenChange(true)}
      >
        <Sparkles className="size-4" />
        <span className="hidden sm:inline">{t("launcherLabel")}</span>
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="h-[100dvh] w-full gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b pr-14">
            <SheetTitle>{t("sheetTitle")}</SheetTitle>
            <SheetDescription>{t("sheetDescription")}</SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-4">
                {conversation.length === 0 && (
                  <div className="space-y-4 rounded-2xl border bg-accent/20 p-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{t("welcomeTitle")}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("welcomeDescription")}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t("starterLabel")}
                      </p>
                      <div className="grid gap-2">
                        {starterPrompts.map((prompt) => (
                          <Button
                            key={prompt}
                            type="button"
                            variant="outline"
                            className="h-auto justify-start whitespace-normal py-3 text-left"
                            onClick={() => {
                              void sendMessage(prompt);
                            }}
                          >
                            {prompt}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {conversation.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex gap-3 ${
                      entry.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {entry.role === "assistant" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bot className="size-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] space-y-3 rounded-2xl px-4 py-3 text-sm ${
                        entry.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : entry.status === "failed"
                            ? "border border-destructive/30 bg-destructive/5"
                            : "border bg-background"
                      }`}
                    >
                      {entry.role === "assistant" && entry.status === "pending" ? (
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" />
                          {t("sending")}
                        </span>
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {entry.content}
                        </p>
                      )}

                      {entry.status !== "failed" &&
                        entry.recommendedProducts &&
                        entry.recommendedProducts.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {t("topMatches")}
                            </p>
                            <div className="grid gap-2">
                              {entry.recommendedProducts.map((product) => (
                                <AssistantProductCard
                                  key={`${entry.id}-${product.id}`}
                                  locale={locale}
                                  product={product}
                                  onClick={() =>
                                    handleProductClick(entry, product)
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        )}

                      {entry.status !== "failed" &&
                        entry.citations &&
                        entry.citations.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {t("sources")}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {entry.citations.map((citation) =>
                                citation.href ? (
                                  <Link
                                    key={citation.sourceKey}
                                    href={citation.href}
                                    className="rounded-full border px-3 py-1 text-xs hover:border-primary hover:text-primary"
                                    onClick={() => handleCitationClick(citation)}
                                  >
                                    {citation.title}
                                  </Link>
                                ) : (
                                  <span
                                    key={citation.sourceKey}
                                    className="rounded-full border px-3 py-1 text-xs"
                                  >
                                    {citation.title}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        )}

                      {entry.status !== "failed" &&
                        entry.followUpSuggestions &&
                        entry.followUpSuggestions.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {t("followUp")}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {entry.followUpSuggestions.map((suggestion, index) => (
                                <Button
                                  key={`${entry.id}-${index}-${suggestion.prompt}`}
                                  type="button"
                                  variant="outline"
                                  className="h-auto rounded-full px-3 py-1 text-left text-xs"
                                  onClick={() => {
                                    void sendMessage(suggestion.prompt);
                                  }}
                                >
                                  {suggestion.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                      {entry.status === "failed" && (
                        <div className="space-y-3 rounded-xl bg-background/80 p-3">
                          <p className="text-xs text-muted-foreground">
                            {t("failed")}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              void retryAssistantEntry(entry.id);
                            }}
                            disabled={isSending}
                          >
                            {t("retry")}
                          </Button>
                        </div>
                      )}

                      {entry.handoff && (
                        <div className="rounded-xl bg-accent/30 p-3">
                          <p className="text-sm font-medium">{t("handoffTitle")}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("handoffDescription")}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            className="mt-3 bg-[#006d28] text-white hover:bg-[#1da851]"
                            onClick={() => {
                              void openHandoff(entry.handoff!.url);
                            }}
                          >
                            <MessageCircle className="size-4" />
                            {entry.handoff.label}
                          </Button>
                        </div>
                      )}
                    </div>

                    {entry.role === "user" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                        <User className="size-4" />
                      </div>
                    )}
                  </div>
                ))}

                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <div className="shrink-0 border-t p-4">
              <div className="space-y-3">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={t("composerPlaceholder")}
                  className="min-h-24 resize-none"
                  maxLength={ASSISTANT_MAX_USER_MESSAGE_CHARS}
                />

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
                  <Button
                    type="button"
                    onClick={() => {
                      void sendMessage();
                    }}
                    disabled={isSending || !input.trim()}
                  >
                    {isSending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    {t("send")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
