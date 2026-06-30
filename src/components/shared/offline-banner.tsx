"use client";

import { useNetwork } from "@/hooks/use-network";
import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";

export function OfflineBanner() {
  const { isOnline } = useNetwork();
  const t = useTranslations();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>{t("offline")}</span>
    </div>
  );
}
