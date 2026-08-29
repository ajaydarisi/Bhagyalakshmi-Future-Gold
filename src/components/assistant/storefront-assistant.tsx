"use client";

import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { AssistantProductCard } from "@/components/assistant/assistant-product-card";
import { MessageResponse } from "@/components/ai-elements/message";
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
import { useVoiceSession } from "@/hooks/use-voice-session";
import {
  ASSISTANT_MAX_ASSISTANT_MESSAGE_CHARS,
  ASSISTANT_MAX_USER_MESSAGE_CHARS,
  ASSISTANT_REQUEST_WINDOW,
  ASSISTANT_STORAGE_MAX_CHARS,
  ASSISTANT_STORAGE_MAX_ENTRIES,
} from "@/lib/assistant-config";
import { detectAssistantLanguage } from "@/lib/assistant-language";
import {
  sanitizeAssistantNavigation,
  sanitizeAssistantNavigationOptions,
} from "@/lib/assistant-navigation";
import { readAssistantStream } from "@/lib/assistant-stream";
import { isCurrentAssistantRequest } from "@/lib/assistant-request-state";
import { trackEvent } from "@/lib/gtag";
import { cn } from "@/lib/utils";
import { SentenceStream } from "@/lib/voice/sentence-stream";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import type {
  AssistantHandoff,
  AssistantNavigationResolution,
  AssistantNavigationOption,
  AssistantPageContext,
  AssistantProductMatch,
  AssistantReply,
  AssistantFollowUpSuggestion,
  CatalogMessage,
  Citation,
} from "@/types/search";
import {
  Bot,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Square,
  User,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";

const subscribeToHydration = () => () => {};

function useHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
}

interface AssistantConversationEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "pending" | "streaming" | "ready" | "failed";
  citations?: Citation[];
  recommendedProducts?: AssistantProductMatch[];
  followUpSuggestions?: AssistantFollowUpSuggestion[];
  navigationOptions?: AssistantNavigationOption[];
  handoff?: AssistantHandoff | null;
  errorMessage?: string | null;
}

interface StoredAssistantConversation {
  version: number;
  conversation: AssistantConversationEntry[];
}

interface ActiveAssistantRequest {
  controller: AbortController;
  requestId: string;
  source: "text" | "voice";
  userEntryId: string;
  assistantEntryId: string;
  utteranceId?: number;
  cancelledByTurn: boolean;
}

interface AssistantStreamHandlers {
  onDelta?: (delta: string) => void;
  onReset?: () => void;
}

interface PendingNavigationOptions {
  options: AssistantNavigationOption[];
  language: "en" | "te";
  navigationResolution?: Exclude<AssistantNavigationResolution, "miss">;
  expiresAt: number;
  timeoutId: number;
}

const ASSISTANT_STORAGE_KEY = "bfg-storefront-assistant-session";
const ASSISTANT_STORAGE_VERSION = 3;
const ASSISTANT_CLIENT_TIMEOUT_MS = 28_000;
const ASSISTANT_NAVIGATION_OPTION_TIMEOUT_MS = 60_000;

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

function normalizeNavigationOptions(reply: AssistantReply) {
  return sanitizeAssistantNavigationOptions(reply.navigationOptions);
}

function normalizeNavigationResolution(
  value: unknown,
): AssistantNavigationResolution | undefined {
  return typeof value === "string" &&
    ["deterministic", "dynamic", "grounded", "llm", "miss"].includes(value)
    ? (value as AssistantNavigationResolution)
    : undefined;
}

export function StorefrontAssistant() {
  const hydrated = useHydrated();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("assistant");
  const voiceT = useTranslations("voice");
  const { items: cartItems, itemCount } = useCart();
  const {
    uiState: voiceState,
    sessionId: voiceSessionId,
    errorCode: voiceErrorCode,
    muted: voiceMuted,
    toggleMute: toggleVoiceMute,
    start: startVoice,
    stop: stopVoice,
    interrupt: interruptVoice,
    startSpeaking: startVoiceSpeaking,
    appendSpeech: appendVoiceSpeech,
    finishSpeaking: finishVoiceSpeaking,
    resetSpeaking: resetVoiceSpeaking,
  } = useVoiceSession({
    mode: "assistant",
    language: "auto",
    onTranscript: handleVoiceTranscript,
    onTurnCancelled: handleVoiceTurnCancelled,
  });
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [conversation, setConversation] = useState<AssistantConversationEntry[]>(
    () => loadStoredConversation()
  );
  const [isSending, setIsSending] = useState(false);
  /** Which kind of request is in flight. The lockout below exists to protect a
   *  TYPED request from being clobbered; keying it on the bare isSending flag
   *  also disabled every recovery control after a voice failure. */
  const [sendingSource, setSendingSource] = useState<"text" | "voice" | null>(null);
  const [pendingNavigationOptions, setPendingNavigationOptions] =
    useState<PendingNavigationOptions | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const conversationRef = useRef(conversation);
  const isSendingRef = useRef(false);
  const activeAssistantRequestRef = useRef<ActiveAssistantRequest | null>(null);
  const trackedVoiceErrorRef = useRef<string | null>(null);
  const pendingNavigationOptionsRef = useRef<PendingNavigationOptions | null>(null);
  const voiceEnabled = Boolean(process.env.NEXT_PUBLIC_VOICE_WS_URL);
  const voiceActive =
    voiceState === "connecting" ||
    voiceState === "listening" ||
    voiceState === "thinking" ||
    voiceState === "speaking";
  const showVoiceActivity =
    voiceEnabled && voiceState !== "idle";
  /** Only a typed request may lock the mic. A stale VOICE request is exactly
   *  what the customer is trying to escape when they tap the mic again. */
  const isSendingText = isSending && sendingSource !== "voice";

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
    const code = voiceState === "mic_denied" ? "mic_denied" : voiceErrorCode;
    if (!code) {
      trackedVoiceErrorRef.current = null;
      return;
    }
    if (trackedVoiceErrorRef.current === code) return;
    trackedVoiceErrorRef.current = code;
    trackEvent("assistant_voice_error", { code, pathname, locale });
  }, [locale, pathname, voiceErrorCode, voiceState]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [conversation, isSending, open]);

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

  function clearPendingNavigationOptions() {
    const pending = pendingNavigationOptionsRef.current;
    if (pending) {
      window.clearTimeout(pending.timeoutId);
    }
    pendingNavigationOptionsRef.current = null;
    setPendingNavigationOptions(null);
  }

  function setPendingNavigationChoices(
    options: AssistantNavigationOption[],
    language: "en" | "te",
    navigationResolution?: Exclude<AssistantNavigationResolution, "miss">,
  ) {
    clearPendingNavigationOptions();
    if (options.length === 0) return;

    const pending: PendingNavigationOptions = {
      options,
      language,
      navigationResolution,
      expiresAt: Date.now() + ASSISTANT_NAVIGATION_OPTION_TIMEOUT_MS,
      timeoutId: window.setTimeout(() => {
        if (pendingNavigationOptionsRef.current === pending) {
          clearPendingNavigationOptions();
        }
      }, ASSISTANT_NAVIGATION_OPTION_TIMEOUT_MS),
    };
    pendingNavigationOptionsRef.current = pending;
    setPendingNavigationOptions(pending);
  }

  function resolvePendingNavigationOption(message: string) {
    const pending = pendingNavigationOptionsRef.current;
    if (!pending) return null;
    if (pending.expiresAt <= Date.now()) {
      clearPendingNavigationOptions();
      return null;
    }

    const normalized = message.trim().toLowerCase();
    const ordinalPatterns = [
      /^(?:1|one|first|మొదటి|ఒకటి|modati)(?:\s+(?:one|option|product|order|ది))?$/i,
      /^(?:2|two|second|రెండో|రెండు|rendo)(?:\s+(?:one|option|product|order|ది))?$/i,
      /^(?:3|three|third|మూడో|మూడు|mudo)(?:\s+(?:one|option|product|order|ది))?$/i,
    ];
    const ordinalIndex = ordinalPatterns.findIndex((pattern) => pattern.test(normalized));
    if (ordinalIndex >= 0 && pending.options[ordinalIndex]) {
      return pending.options[ordinalIndex];
    }

    return pending.options.find((option) => option.label.toLowerCase() === normalized) ?? null;
  }

  function cancelVoiceAssistantRequest(utteranceId?: number) {
    clearPendingNavigationOptions();
    const active = activeAssistantRequestRef.current;
    if (
      !active ||
      active.source !== "voice" ||
      (utteranceId !== undefined && active.utteranceId !== utteranceId)
    ) {
      return;
    }

    active.cancelledByTurn = true;
    active.controller.abort();
    activeAssistantRequestRef.current = null;
    isSendingRef.current = false;
    setIsSending(false);
    setSendingSource(null);
    updateConversation((current) =>
      current.filter(
        (entry) => entry.id !== active.userEntryId && entry.id !== active.assistantEntryId
      )
    );
  }

  async function openHandoff(url: string) {
    trackEvent("assistant_handoff_click", { pathname, locale });

    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url });
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function navigateAssistantNavigation(
    navigationValue: unknown,
    source: "text" | "voice",
    navigationResolution?: Exclude<AssistantNavigationResolution, "miss">,
  ) {
    const navigation = sanitizeAssistantNavigation(navigationValue);
    if (!navigation) {
      return false;
    }

    clearPendingNavigationOptions();

    // Begin fetching the destination before the acknowledgement is rendered
    // or spoken. A prefetch failure must never block the validated transition.
    router.prefetch(navigation.href);

    trackEvent("assistant_navigation", {
      pathname,
      locale,
      destination: navigation.destination,
      navigation_kind: navigation.kind,
      source,
      resolver: navigationResolution ?? "legacy",
    });
    // Do not call handleOpenChange(false): it deliberately stops the active
    // voice session, while a voice navigation acknowledgement must keep playing.
    setOpen(false);
    router.push(navigation.href);
    return true;
  }

  function navigateAssistantReply(reply: AssistantReply, source: "text" | "voice") {
    const navigationResolution = normalizeNavigationResolution(
      reply.navigationResolution,
    );
    return navigateAssistantNavigation(
      reply.navigation,
      source,
      navigationResolution === "miss" ? undefined : navigationResolution,
    );
  }

  function selectNavigationOption(
    option: AssistantNavigationOption,
    source: "text" | "voice",
    selectedMessage?: string,
  ) {
    const pending = pendingNavigationOptionsRef.current;
    if (
      !pending ||
      pending.expiresAt <= Date.now() ||
      !pending.options.some((candidate) => candidate.id === option.id)
    ) {
      clearPendingNavigationOptions();
      return null;
    }

    const acknowledgementLocale = pending.language;
    const acknowledgement =
      acknowledgementLocale === "te"
        ? "మీరు ఎంచుకున్న ఎంపికను తెరుస్తున్నాను."
        : "Opening your selected option.";

    if (selectedMessage) {
      updateConversation((current) => [
        ...current,
        {
          id: generateEntryId(),
          role: "user",
          content: selectedMessage,
          status: "ready",
        },
        {
          id: generateEntryId(),
          role: "assistant",
          content: acknowledgement,
          status: "ready",
        },
      ]);
    }

    return navigateAssistantNavigation(
      option.navigation,
      source,
      pending.navigationResolution,
    )
      ? acknowledgement
      : null;
  }

  async function sendMessage(
    rawMessage?: string,
    source: "text" | "voice" = "text",
    utteranceId?: number,
    streamHandlers: AssistantStreamHandlers = {},
  ): Promise<string | null> {
    const nextInput = sanitizeEntryText(
      rawMessage ?? input,
      ASSISTANT_MAX_USER_MESSAGE_CHARS
    );
    if (!nextInput) {
      return null;
    }

    const selectedNavigationOption = resolvePendingNavigationOption(nextInput);
    if (selectedNavigationOption) {
      setInput("");
      return selectNavigationOption(selectedNavigationOption, source, nextInput);
    }
    clearPendingNavigationOptions();

    if (isSendingRef.current) {
      if (source === "voice" && activeAssistantRequestRef.current?.source === "voice") {
        cancelVoiceAssistantRequest(activeAssistantRequestRef.current.utteranceId);
      } else {
        return null;
      }
    }

    if (source === "text" && voiceActive) {
      stopVoice();
    }
    isSendingRef.current = true;
    setIsSending(true);
    setSendingSource(source);

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
    const request: ActiveAssistantRequest = {
      controller: new AbortController(),
      requestId: generateEntryId(),
      source,
      userEntryId,
      assistantEntryId,
      utteranceId,
      cancelledByTurn: false,
    };
    activeAssistantRequestRef.current = request;
    let timeout = 0;
    const armTimeout = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(
        () => request.controller.abort(),
        ASSISTANT_CLIENT_TIMEOUT_MS,
      );
    };
    armTimeout();

    conversationRef.current = pendingConversation;
    setConversation(pendingConversation);
    setInput("");
    setOpen(true);
    trackEvent("assistant_message_sent", { pathname, locale });

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          Accept: "application/x-ndjson",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // The API receives the selected storefront locale as its fallback;
          // response language is derived independently from the customer query.
          locale,
          source,
          // Correlates this turn with the voice service's own logs.
          voiceSessionId,
          messages: requestMessages,
          pageContext: buildPageContext(),
        }),
        signal: request.controller.signal,
      });

      if (activeAssistantRequestRef.current?.requestId !== request.requestId) {
        return null;
      }

      if (!response.ok) {
        throw new Error("Assistant request failed");
      }

      const data = await readAssistantStream(response, {
        onAnswerDelta(delta) {
          if (activeAssistantRequestRef.current?.requestId !== request.requestId) return;
          armTimeout();
          streamHandlers.onDelta?.(delta);
          updateConversation((current) =>
            current.map((entry) =>
              entry.id === assistantEntryId
                ? {
                    ...entry,
                    content: `${entry.content}${delta}`.slice(
                      0,
                      ASSISTANT_MAX_ASSISTANT_MESSAGE_CHARS,
                    ),
                    status: "streaming",
                  }
                : entry,
            ),
          );
        },
        onAnswerReset() {
          if (activeAssistantRequestRef.current?.requestId !== request.requestId) return;
          armTimeout();
          streamHandlers.onReset?.();
          updateConversation((current) =>
            current.map((entry) =>
              entry.id === assistantEntryId
                ? { ...entry, content: "", status: "pending" }
                : entry,
            ),
          );
        },
      });

      // A barge-in can cancel this request after the reader has received its
      // final event but before this continuation runs. Do not let that stale
      // answer reach handleVoiceTranscript(), which would otherwise resume
      // speech for the previous utterance during the next turn.
      if (!isCurrentAssistantRequest({
        activeRequestId: activeAssistantRequestRef.current?.requestId,
        requestId: request.requestId,
        wasCancelled: request.cancelledByTurn,
      })) {
        return null;
      }

      const reply = data.reply;
      if (!reply) {
        throw new Error("Assistant reply missing");
      }
      const recommendedProducts = normalizeRecommendedProducts(reply);
      const navigationOptions = normalizeNavigationOptions(reply);
      const navigationResolution = normalizeNavigationResolution(
        reply.navigationResolution,
      );
      const responseLanguage = detectAssistantLanguage(nextInput, locale);
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
                navigationOptions:
                  navigationOptions.length > 0 ? navigationOptions : undefined,
                handoff: data.handoff,
                errorMessage: null,
              }
            : entry
        )
      );
      if (navigationOptions.length > 0) {
        for (const option of navigationOptions) {
          const navigation = sanitizeAssistantNavigation(option.navigation);
          if (navigation) {
            router.prefetch(navigation.href);
          }
        }
        setPendingNavigationChoices(
          navigationOptions,
          responseLanguage,
          navigationResolution === "miss" ? undefined : navigationResolution,
        );
      } else if (navigationResolution === "miss") {
        trackEvent("assistant_navigation", {
          pathname,
          locale,
          destination: "none",
          navigation_kind: "none",
          source,
          resolver: "miss",
        });
      }
      const navigation = sanitizeAssistantNavigation(reply.navigation);
      if (navigation) {
        router.prefetch(navigation.href);
      }
      navigateAssistantReply(reply, source);
      return reply.answer;
    } catch {
      if (
        request.cancelledByTurn ||
        activeAssistantRequestRef.current?.requestId !== request.requestId
      ) {
        return null;
      }
      const errorText = t("error");
      updateConversation((current) =>
        current.map((entry) =>
          entry.id === assistantEntryId
            ? {
                ...entry,
                content: errorText,
                status: "failed",
                errorMessage: errorText,
                handoff: null,
              }
            : entry
        )
      );
      return null;
    } finally {
      window.clearTimeout(timeout);
      if (activeAssistantRequestRef.current?.requestId === request.requestId) {
        activeAssistantRequestRef.current = null;
        isSendingRef.current = false;
        setIsSending(false);
        setSendingSource(null);
      }
    }
  }

  async function retryAssistantEntry(entryId: string) {
    if (isSendingRef.current) {
      return;
    }
    clearPendingNavigationOptions();

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
    setSendingSource("text");
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          Accept: "application/x-ndjson",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locale,
          messages: buildRequestMessages(messagesBeforeRetry),
          pageContext: buildPageContext(),
        }),
      });

      if (!response.ok) {
        throw new Error("Assistant request failed");
      }

      const data = await readAssistantStream(response, {
        onAnswerDelta(delta) {
          updateConversation((current) =>
            current.map((item) =>
              item.id === entryId
                ? {
                    ...item,
                    content: `${item.content}${delta}`.slice(
                      0,
                      ASSISTANT_MAX_ASSISTANT_MESSAGE_CHARS,
                    ),
                    status: "streaming",
                  }
                : item,
            ),
          );
        },
        onAnswerReset() {
          updateConversation((current) =>
            current.map((item) =>
              item.id === entryId
                ? { ...item, content: "", status: "pending" }
                : item,
            ),
          );
        },
      });

      if (!data.reply) {
        throw new Error("Assistant reply missing");
      }

      const reply = data.reply;
      const recommendedProducts = normalizeRecommendedProducts(reply);
      const navigationOptions = normalizeNavigationOptions(reply);
      const navigationResolution = normalizeNavigationResolution(
        reply.navigationResolution,
      );
      const retryLanguage = detectAssistantLanguage(
        [...messagesBeforeRetry]
          .reverse()
          .find((message) => message.role === "user")?.content ?? locale,
        locale,
      );
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
                navigationOptions:
                  navigationOptions.length > 0 ? navigationOptions : undefined,
                handoff: data.handoff,
                errorMessage: null,
              }
            : item
        )
      );
      if (navigationOptions.length > 0) {
        for (const option of navigationOptions) {
          const navigation = sanitizeAssistantNavigation(option.navigation);
          if (navigation) {
            router.prefetch(navigation.href);
          }
        }
        setPendingNavigationChoices(
          navigationOptions,
          retryLanguage,
          navigationResolution === "miss" ? undefined : navigationResolution,
        );
      } else if (navigationResolution === "miss") {
        trackEvent("assistant_navigation", {
          pathname,
          locale,
          destination: "none",
          navigation_kind: "none",
          source: "text",
          resolver: "miss",
        });
      }
      const navigation = sanitizeAssistantNavigation(reply.navigation);
      if (navigation) {
        router.prefetch(navigation.href);
      }
      navigateAssistantReply(reply, "text");
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
      setSendingSource(null);
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
    if (!nextOpen && voiceActive) {
      stopVoice();
    }
    if (!nextOpen) {
      clearPendingNavigationOptions();
    }
    setOpen(nextOpen);
  }

  function handleVoiceToggle() {
    if (voiceActive) {
      stopVoice();
      trackEvent("assistant_voice_stop", { pathname, locale });
      return;
    }
    if (isSendingRef.current && activeAssistantRequestRef.current?.source !== "voice") {
      return;
    }

    if (!open) {
      trackEvent("assistant_open", { pathname, locale });
    }
    setOpen(true);
    trackEvent("assistant_voice_start", { pathname, locale });
    void startVoice();
  }

  async function handleVoiceTranscript(transcript: string, utteranceId: number) {
    trackEvent("assistant_voice_transcript", { pathname, locale });
    const responseLocale = detectAssistantLanguage(transcript, locale);
    const speech = new SentenceStream();
    let speechStarted = false;
    const ensureSpeechStarted = () => {
      if (!speechStarted) {
        speechStarted = startVoiceSpeaking(utteranceId, responseLocale);
      }
      return speechStarted;
    };
    const answer = await sendMessage(transcript, "voice", utteranceId, {
      onDelta(delta) {
        if (!ensureSpeechStarted()) return;
        for (const sentence of speech.push(delta)) {
          appendVoiceSpeech(sentence, utteranceId);
        }
      },
      onReset() {
        speech.reset();
        if (speechStarted) resetVoiceSpeaking(utteranceId);
      },
    });
    if (answer && ensureSpeechStarted()) {
      for (const sentence of speech.finish()) {
        appendVoiceSpeech(sentence, utteranceId);
      }
      finishVoiceSpeaking(utteranceId);
    } else if (speechStarted) {
      finishVoiceSpeaking(utteranceId);
    } else {
      // The grounded request failed before producing any text, so we never sent
      // speak_start and the service is still holding this turn in `thinking`
      // behind its 30s response timer. Release it now instead of making the
      // customer wait out a timeout that then misreports the cause.
      interruptVoice();
    }
  }

  function handleVoiceTurnCancelled(utteranceId: number) {
    cancelVoiceAssistantRequest(utteranceId);
  }

  function getVoiceErrorMessage() {
    if (voiceState === "mic_denied") {
      return voiceT("micDenied");
    }
    if (voiceErrorCode === "busy") {
      return voiceT("busy");
    }
    if (voiceErrorCode === "no_mic") {
      return voiceT("audioError");
    }
    if (voiceErrorCode === "no_speech") {
      return voiceT("noSpeech");
    }
    if (voiceErrorCode === "assistant_timeout") {
      return voiceT("responseTimeout");
    }
    if (
      voiceErrorCode === "tts_failed" ||
      voiceErrorCode === "audio_backpressure" ||
      voiceErrorCode === "audio_playback_failed" ||
      voiceErrorCode === "audio_unavailable"
    ) {
      return voiceT("audioUnavailable");
    }
    if (voiceErrorCode === "not_supported") {
      return voiceT("notSupported");
    }
    return voiceT("connectionError");
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
      <div className="fixed bottom-24 right-4 z-40 lg:bottom-6 lg:right-6">
        {/* attention pulse ring */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-gold-400/60"
        />
        <div className="flex overflow-hidden rounded-full shadow-[var(--shadow-gold)] hover:shadow-[0_10px_32px_rgb(var(--gold-rgb)/0.5)]">
          <Button
            type="button"
            variant="gold"
            size="bfg-md"
            aria-label={t("launcherLabel")}
            data-testid="assistant-launcher"
            disabled={!hydrated}
            className={cn(
              "bfg-gold-shimmer group cursor-pointer shadow-none hover:shadow-none",
              voiceEnabled ? "rounded-r-none pr-3" : "rounded-full",
            )}
            onClick={() => handleOpenChange(true)}
          >
            <Sparkles className="size-5 motion-safe:animate-[bfg-twinkle_2.2s_ease-in-out_infinite] transition-transform group-hover:rotate-12" />
            <span className="hidden sm:inline">{t("launcherLabel")}</span>
          </Button>
          {voiceEnabled && (
            <Button
              type="button"
              variant={voiceActive ? "destructive" : "gold"}
              size="icon"
              aria-label={voiceActive ? voiceT("stop") : voiceT("start")}
              aria-pressed={voiceActive}
              disabled={!hydrated || (isSendingText && !voiceActive)}
              data-testid="assistant-voice-launcher"
              className={cn(
                "h-11 w-11 rounded-l-none rounded-r-full border-l border-black/15 shadow-none hover:shadow-none",
                voiceActive && "animate-pulse",
              )}
              onClick={handleVoiceToggle}
            >
              {voiceState === "connecting" ? (
                <Loader2 className="size-5 animate-spin" />
              ) : voiceActive ? (
                <MicOff className="size-5" />
              ) : (
                <Mic className="size-5" />
              )}
            </Button>
          )}
        </div>
      </div>

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
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("starterLabel")}
                      </p>
                      <div className="grid gap-2">
                        {starterPrompts.map((prompt) => (
                          <Button
                            key={prompt}
                            type="button"
                            variant="gold-outline"
                            className="h-auto justify-start whitespace-normal py-3 text-left normal-case tracking-normal"
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
                    data-assistant-message={entry.role}
                    className={`flex min-w-0 gap-3 ${
                      entry.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {entry.role === "assistant" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-700">
                        <Bot className="size-4" />
                      </div>
                    )}

                    <div
                      data-assistant-message-content
                      className={`min-w-0 max-w-[85%] space-y-3 rounded-2xl px-4 py-3 text-sm ${
                        entry.role === "user"
                          ? "bg-gold-500 text-white"
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
                      ) : entry.role === "assistant" ? (
                        <div data-assistant-response className="min-w-0">
                          <MessageResponse
                            className="h-auto min-w-0 w-full whitespace-normal break-words leading-relaxed"
                            isAnimating={entry.status === "streaming"}
                          >
                            {entry.content}
                          </MessageResponse>
                        </div>
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
                        entry.navigationOptions &&
                        entry.navigationOptions.length > 0 &&
                        pendingNavigationOptions &&
                        entry.navigationOptions.some((option) =>
                          pendingNavigationOptions.options.some(
                            (pendingOption) => pendingOption.id === option.id,
                          ),
                        ) && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {t("navigationOptions")}
                            </p>
                            <div className="grid gap-2">
                              {entry.navigationOptions.map((option, index) => {
                                const isActive = pendingNavigationOptions.options.some(
                                  (pendingOption) => pendingOption.id === option.id,
                                );
                                if (!isActive) return null;

                                return (
                                  <Button
                                    key={`${entry.id}-${option.id}`}
                                    type="button"
                                    variant="gold-outline"
                                    data-assistant-navigation-option={index + 1}
                                    className="h-auto justify-start whitespace-normal py-3 text-left normal-case tracking-normal"
                                    onClick={() => {
                                      selectNavigationOption(option, "text");
                                    }}
                                  >
                                    <span className="flex min-w-0 flex-col items-start gap-0.5">
                                      <span>{`${index + 1}. ${option.label}`}</span>
                                      {option.description ? (
                                        <span className="text-xs font-normal text-muted-foreground">
                                          {option.description}
                                        </span>
                                      ) : null}
                                    </span>
                                  </Button>
                                );
                              })}
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
                                    className="max-w-full break-words rounded-full border px-3 py-1 text-xs hover:border-[var(--border-gold)] hover:text-text-gold"
                                    onClick={() => handleCitationClick(citation)}
                                  >
                                    {citation.title}
                                  </Link>
                                ) : (
                                  <span
                                    key={citation.sourceKey}
                                    className="max-w-full break-words rounded-full border px-3 py-1 text-xs"
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
                            <div className="flex flex-col items-start gap-2">
                              {entry.followUpSuggestions.map((suggestion, index) => (
                                <Button
                                  key={`${entry.id}-${index}-${suggestion.prompt}`}
                                  type="button"
                                  variant="gold-outline"
                                  className="h-auto max-w-full whitespace-normal break-words rounded-full px-3 py-1 text-left text-xs"
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
                            variant="gold-outline"
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

                {showVoiceActivity && (
                  <div
                    role={
                      voiceState === "error" ||
                      voiceState === "mic_denied" ||
                      Boolean(voiceErrorCode)
                        ? "alert"
                        : "status"
                    }
                    className={cn(
                      "space-y-3 rounded-2xl border bg-accent/20 p-4",
                      (voiceState === "error" ||
                        voiceState === "mic_denied" ||
                        Boolean(voiceErrorCode)) &&
                        "border-destructive/30 bg-destructive/5",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-sm font-medium">
                        <Mic className="size-4" />
                        {voiceT("title")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {voiceState === "connecting" && voiceT("connecting")}
                        {voiceState === "listening" && voiceT("listening")}
                        {voiceState === "thinking" && voiceT("thinking")}
                        {voiceState === "speaking" && voiceT("speaking")}
                      </span>
                    </div>

                    {voiceState === "listening" && !voiceMuted && (
                      <p className="text-xs text-muted-foreground">
                        {voiceT("liveHint")}
                      </p>
                    )}

                    {voiceMuted && (
                      <p className="text-xs text-muted-foreground">
                        {voiceT("mutedHint")}
                      </p>
                    )}

                    {(voiceState === "error" ||
                      voiceState === "mic_denied" ||
                      Boolean(voiceErrorCode)) && (
                      <p className="text-sm text-destructive">{getVoiceErrorMessage()}</p>
                    )}

                    {(voiceState === "listening" ||
                      voiceState === "thinking" ||
                      voiceState === "speaking") && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-pressed={voiceMuted}
                          onClick={toggleVoiceMute}
                        >
                          {voiceMuted ? (
                            <Mic className="size-3" />
                          ) : (
                            <MicOff className="size-3" />
                          )}
                          {voiceMuted ? voiceT("unmute") : voiceT("mute")}
                        </Button>
                        {voiceState === "speaking" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={interruptVoice}
                          >
                            <Square className="size-3" />
                            {voiceT("interrupt")}
                          </Button>
                        )}
                      </div>
                    )}

                    {/* The failed states had no working control at all: mute and
                        interrupt only render while live, and both mic buttons are
                        disabled while a request is in flight. startVoice() tears
                        down the previous session first, so this is safe to spam. */}
                    {(voiceState === "error" || voiceState === "mic_denied") && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleVoiceToggle}
                        >
                          <Mic className="size-3" />
                          {voiceT("retry")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

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
                  <div className="flex shrink-0 items-center gap-2">
                    {voiceEnabled && (
                      <Button
                        type="button"
                        variant={voiceActive ? "destructive" : "gold-outline"}
                        size="icon"
                        aria-label={voiceActive ? voiceT("stop") : voiceT("start")}
                        aria-pressed={voiceActive}
                        disabled={isSendingText && !voiceActive}
                        onClick={handleVoiceToggle}
                      >
                        {voiceState === "connecting" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : voiceActive ? (
                          <MicOff className="size-4" />
                        ) : (
                          <Mic className="size-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="gold"
                      size="bfg-md"
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
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
