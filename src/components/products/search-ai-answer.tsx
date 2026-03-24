"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { GroundedReply } from "@/types/search";

interface SearchAiAnswerProps {
  query: string;
  locale: string;
}

export function SearchAiAnswer({ query, locale }: SearchAiAnswerProps) {
  const t = useTranslations("search.ai");
  const [reply, setReply] = useState<GroundedReply | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAskAi() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/search/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, locale }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate an answer");
      }

      const data = (await response.json()) as { reply: GroundedReply | null };
      if (!data.reply) {
        setError(t("noAnswer"));
        setReply(null);
        return;
      }

      setReply(data.reply);
    } catch {
      setError(t("unavailable"));
      setReply(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" />
          {t("title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!reply && (
          <Button
            type="button"
            onClick={handleAskAi}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {isLoading ? t("loading") : t("button")}
          </Button>
        )}

        {reply && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed">{reply.answer}</p>

            {reply.citations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("citations")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {reply.citations.map((citation) =>
                    citation.href ? (
                      <Link
                        key={citation.sourceKey}
                        href={citation.href}
                        className="rounded-full border px-3 py-1 text-sm hover:border-primary hover:text-primary"
                      >
                        {citation.title}
                      </Link>
                    ) : (
                      <span
                        key={citation.sourceKey}
                        className="rounded-full border px-3 py-1 text-sm"
                      >
                        {citation.title}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}

            {reply.followUpPrompt && (
              <p className="text-sm text-muted-foreground">
                {t("followUp")} {reply.followUpPrompt}
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-muted-foreground">{error}</p>
        )}

        <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
      </CardContent>
    </Card>
  );
}
