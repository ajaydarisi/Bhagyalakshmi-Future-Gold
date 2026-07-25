"use client";

import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  getAssistantRouteManifest,
  serializeAssistantRoute,
} from "@/lib/assistant-route-manifest";
import {
  ASSISTANT_MAX_USER_MESSAGE_CHARS,
} from "@/lib/assistant-config";
import {
  resolveAssistantNavigation,
  sanitizeAssistantNavigation,
  sanitizeAssistantNavigationOptions,
} from "@/lib/assistant-navigation";
import { readAssistantStream } from "@/lib/assistant-stream";
import { STORE_MODE } from "@/lib/constants";
import { trackEvent } from "@/lib/gtag";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "@/i18n/routing";
import type {
  AssistantNavigation,
  AssistantNavigationOption,
  AssistantReply,
} from "@/types/search";
import { ArrowRight, Bot, Compass, Loader2, Sparkles } from "lucide-react";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type OmniboxCopy = {
  launcher: string;
  launcherHint: string;
  title: string;
  description: string;
  placeholder: string;
  askAi: string;
  askAiHint: string;
  routes: string;
  accountRoutes: string;
  assistantResult: string;
  options: string;
  loading: string;
  error: string;
  noResult: string;
};

type OmniboxCandidate = {
  id: string;
  label: string;
  description: string;
  navigation: AssistantNavigation;
  auth: "public" | "optional" | "required";
  value: string;
};

const COPY: Record<"en" | "te", OmniboxCopy> = {
  en: {
    launcher: "Navigate",
    launcherHint: "Ask or jump anywhere",
    title: "Navigate the store",
    description:
      "Describe where you want to go, or choose a familiar storefront destination.",
    placeholder: "Try “show earrings under ₹1,000” or “open my orders”…",
    askAi: "Ask AI to navigate",
    askAiHint: "Uses the same safe route resolver as Ask AI.",
    routes: "Suggested destinations",
    accountRoutes: "Your account",
    assistantResult: "Ask AI",
    options: "Choose a destination",
    loading: "Finding the safest destination…",
    error: "I couldn’t resolve that right now. Try a suggested destination or Ask AI again.",
    noResult: "I couldn’t find a safe destination for that request.",
  },
  te: {
    launcher: "నావిగేట్",
    launcherHint: "అడగండి లేదా నేరుగా వెళ్లండి",
    title: "స్టోర్‌లో నావిగేట్ చేయండి",
    description:
      "మీరు ఎక్కడికి వెళ్లాలనుకుంటున్నారో చెప్పండి లేదా పరిచయమైన స్టోర్ గమ్యస్థానాన్ని ఎంచుకోండి.",
    placeholder: "“₹1,000 లోపు ఇయరింగ్స్ చూపించండి” లేదా “నా ఆర్డర్లు తెరవండి” ప్రయత్నించండి…",
    askAi: "నావిగేట్ చేయడానికి AIని అడగండి",
    askAiHint: "Ask AI వాడే సురక్షిత రూట్ రిజాల్వర్‌నే ఉపయోగిస్తుంది.",
    routes: "సూచించిన గమ్యస్థానాలు",
    accountRoutes: "మీ ఖాతా",
    assistantResult: "Ask AI",
    options: "ఒక గమ్యస్థానాన్ని ఎంచుకోండి",
    loading: "సురక్షితమైన గమ్యస్థానాన్ని వెతుకుతోంది…",
    error: "ఇప్పుడే దాన్ని పరిష్కరించలేకపోయాను. సూచించిన గమ్యస్థానాన్ని ఎంచుకోండి లేదా మళ్లీ ప్రయత్నించండి.",
    noResult: "ఈ అభ్యర్థనకు సురక్షితమైన గమ్యస్థానం దొరకలేదు.",
  },
};

function getLocaleCopy(locale: string) {
  return COPY[locale === "te" ? "te" : "en"];
}

function sanitizeInput(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, ASSISTANT_MAX_USER_MESSAGE_CHARS);
}

function buildQuickCandidates(locale: "en" | "te"): OmniboxCandidate[] {
  return getAssistantRouteManifest({ includeEntityRoutes: false }).flatMap((route) => {
    if (route.entityResolution !== "none") {
      return [];
    }

    const navigation = sanitizeAssistantNavigation(
      serializeAssistantRoute(route.id, {}, { storeMode: STORE_MODE }),
    );
    if (!navigation) {
      return [];
    }

    const activeCopy = route.copy[locale];
    const label = activeCopy.examples[0] ?? route.id;
    const description = activeCopy.description;
    const value = [
      route.id,
      route.copy.en.description,
      ...route.copy.en.examples,
      route.copy.te.description,
      ...route.copy.te.examples,
    ].join(" ");

    return [
      {
        id: route.id,
        label,
        description,
        navigation,
        auth: route.auth,
        value,
      },
    ];
  });
}

function getAssistantReplyNavigation(reply: AssistantReply) {
  return sanitizeAssistantNavigation(reply.navigation);
}

interface NavigationOmniboxProps {
  /** Keep the launcher adjacent to, not in place of, conventional navigation. */
  className?: string;
}

/**
 * A global customer-navigation launcher. It uses the manifest for quick
 * destinations, the deterministic resolver for command-shaped input, and the
 * existing assistant API only when richer resolution is necessary.
 */
export function NavigationOmnibox({ className }: NavigationOmniboxProps) {
  const locale = useLocale();
  const activeLocale = locale === "te" ? "te" : "en";
  const copy = getLocaleCopy(locale);
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [navigationOptions, setNavigationOptions] = useState<
    AssistantNavigationOption[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  const quickCandidates = useMemo(
    () => buildQuickCandidates(activeLocale),
    [activeLocale],
  );
  const publicCandidates = useMemo(
    () => quickCandidates.filter((candidate) => candidate.auth !== "required"),
    [quickCandidates],
  );
  const accountCandidates = useMemo(
    () => quickCandidates.filter((candidate) => candidate.auth === "required"),
    [quickCandidates],
  );

  const prefetchNavigation = useCallback(
    (value: unknown) => {
      const navigation = sanitizeAssistantNavigation(value);
      if (!navigation) return;

      try {
        router.prefetch(navigation.href);
      } catch {
        // Prefetching is an enhancement. A valid navigation must still work
        // on slow, offline, or unsupported clients.
      }
    },
    [router],
  );

  const navigate = useCallback(
    (value: unknown, source: "quick" | "deterministic" | "assistant" | "option") => {
      const navigation = sanitizeAssistantNavigation(value);
      if (!navigation) return false;

      prefetchNavigation(navigation);
      trackEvent("assistant_navigation", {
        pathname,
        locale,
        destination: navigation.destination,
        navigation_kind: navigation.kind,
        source: `omnibox_${source}`,
      });
      setInput("");
      setReply(null);
      setNavigationOptions([]);
      setError(null);
      setOpen(false);
      router.push(navigation.href);
      return true;
    },
    [locale, pathname, prefetchNavigation, router],
  );

  useEffect(() => {
    if (!open) return;

    // Only warm public routes on open. Authenticated destinations stay on an
    // explicit hover/select path so opening the palette does not trigger work
    // for private screens.
    for (const candidate of publicCandidates.slice(0, 8)) {
      prefetchNavigation(candidate.navigation);
    }
  }, [open, prefetchNavigation, publicCandidates]);

  useEffect(
    () => () => {
      requestControllerRef.current?.abort();
    },
    [],
  );

  function closeOmnibox() {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setIsResolving(false);
    setOpen(false);
  }

  const openOmnibox = useCallback(() => {
    setError(null);
    setReply(null);
    setNavigationOptions([]);
    setOpen(true);
    trackEvent("navigation_omnibox_open", { pathname, locale });
  }, [locale, pathname]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        openOmnibox();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [openOmnibox]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      closeOmnibox();
      return;
    }

    openOmnibox();
  }

  async function resolveWithAssistant(query: string, controller: AbortController) {
    const response = await fetch("/api/assistant/chat", {
      method: "POST",
      headers: {
        Accept: "application/x-ndjson",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locale: activeLocale,
        source: "text",
        messages: [{ role: "user", content: query }],
        pageContext: { pathname },
      }),
      signal: controller.signal,
    });

    const result = await readAssistantStream(response, {
      onAnswerDelta() {},
      onAnswerReset() {},
    });
    return result.reply;
  }

  async function handleAskAi() {
    const query = sanitizeInput(input);
    if (!query || isResolving) return;

    setError(null);
    setReply(null);
    setNavigationOptions([]);

    const deterministicNavigation = resolveAssistantNavigation(query);
    if (deterministicNavigation) {
      trackEvent("navigation_omnibox_resolved", {
        pathname,
        locale,
        resolver: "deterministic",
      });
      navigate(deterministicNavigation, "deterministic");
      return;
    }

    setIsResolving(true);
    const controller = new AbortController();
    requestControllerRef.current?.abort();
    requestControllerRef.current = controller;
    try {
      const assistantReply = await resolveWithAssistant(query, controller);
      if (controller.signal.aborted || requestControllerRef.current !== controller) return;

      const assistantNavigation = getAssistantReplyNavigation(assistantReply);
      const options = sanitizeAssistantNavigationOptions(
        assistantReply.navigationOptions,
      );
      setInput("");
      setReply(assistantReply);
      setNavigationOptions(options);

      if (assistantNavigation) {
        trackEvent("navigation_omnibox_resolved", {
          pathname,
          locale,
          resolver: "assistant",
        });
        navigate(assistantNavigation, "assistant");
        return;
      }

      for (const option of options) {
        prefetchNavigation(option.navigation);
      }
      trackEvent("navigation_omnibox_resolved", {
        pathname,
        locale,
        resolver: options.length > 0 ? "options" : "miss",
      });
    } catch (caughtError) {
      if ((caughtError as Error).name === "AbortError") return;
      setError(copy.error);
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        setIsResolving(false);
      }
    }
  }

  return (
    <>
      <div
        className={cn(
          "fixed bottom-24 left-4 z-40 lg:bottom-6 lg:left-6",
          className,
        )}
      >
        <button
          type="button"
          className="group flex min-h-11 items-center gap-2 rounded-full border border-[var(--border-gold)] bg-[var(--surface-card)] px-3.5 text-left text-sm font-medium text-text-primary shadow-[0_8px_30px_rgb(51_35_22/0.18)] transition hover:-translate-y-0.5 hover:bg-[rgb(var(--gold-rgb)/0.08)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={copy.launcher}
          aria-keyshortcuts="Control+K Meta+K"
          onClick={() => handleOpenChange(true)}
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-gold-500 text-[var(--text-on-gold)]">
            <Compass className="size-4" aria-hidden />
          </span>
          <span className="hidden min-w-0 sm:flex sm:flex-col">
            <span>{copy.launcher}</span>
            <span className="text-2xs font-normal text-text-secondary">
              {copy.launcherHint}
            </span>
          </span>
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-sans text-2xs text-muted-foreground md:inline">
            ⌘K
          </kbd>
        </button>
      </div>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={copy.title}
        description={copy.description}
        className="sm:max-w-2xl"
      >
        <CommandInput
          autoFocus
          placeholder={copy.placeholder}
          value={input}
          onValueChange={(value) => {
            // A reply for the previous phrase must not be displayed after the
            // customer has started a new destination request.
            requestControllerRef.current?.abort();
            requestControllerRef.current = null;
            setIsResolving(false);
            setInput(value);
            setError(null);
            setReply(null);
            setNavigationOptions([]);
          }}
        />
        <CommandList className="max-h-[min(65vh,34rem)]">
          <CommandGroup>
            <CommandItem
              value={`ask ai ${input}`}
              disabled={!sanitizeInput(input) || isResolving}
              onSelect={() => void handleAskAi()}
              className="cursor-pointer"
            >
              {isResolving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4 text-text-gold" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {isResolving ? copy.loading : copy.askAi}
                </span>
                {!isResolving ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {copy.askAiHint}
                  </span>
                ) : null}
              </span>
              <CommandShortcut>↵</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          {reply || error || navigationOptions.length > 0 ? <CommandSeparator /> : null}

          {error ? (
            <div
              role="status"
              className="px-3 py-3 text-sm text-muted-foreground"
            >
              {error}
            </div>
          ) : null}

          {reply && !getAssistantReplyNavigation(reply) ? (
            <CommandGroup heading={copy.assistantResult}>
              <div
                role="status"
                className="px-2 py-2 text-sm leading-6 text-muted-foreground"
              >
                {reply.answer || copy.noResult}
              </div>
            </CommandGroup>
          ) : null}

          {navigationOptions.length > 0 ? (
            <CommandGroup heading={copy.options}>
              {navigationOptions.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.id} ${option.label} ${option.description ?? ""}`}
                  onPointerMove={() => prefetchNavigation(option.navigation)}
                  onSelect={() => navigate(option.navigation, "option")}
                  className="cursor-pointer"
                >
                  <ArrowRight className="size-4 text-text-gold" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{option.label}</span>
                    {option.description ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          <CommandSeparator />
          <CommandGroup heading={copy.routes}>
            {publicCandidates.map((candidate) => (
              <CommandItem
                key={candidate.id}
                value={candidate.value}
                onPointerMove={() => prefetchNavigation(candidate.navigation)}
                onSelect={() => navigate(candidate.navigation, "quick")}
                className="cursor-pointer"
              >
                <Compass className="size-4 text-text-gold" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{candidate.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {candidate.description}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>

          {accountCandidates.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading={copy.accountRoutes}>
                {accountCandidates.map((candidate) => (
                  <CommandItem
                    key={candidate.id}
                    value={candidate.value}
                    onPointerMove={() => prefetchNavigation(candidate.navigation)}
                    onSelect={() => navigate(candidate.navigation, "quick")}
                    className="cursor-pointer"
                  >
                    <Bot className="size-4 text-text-gold" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{candidate.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {candidate.description}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
