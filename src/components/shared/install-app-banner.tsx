"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useTranslations } from "next-intl";

const DISMISS_KEY = "install-app-banner-dismissed";

export function InstallAppBanner() {
  const [show, setShow] = useState(false);
  const t = useTranslations("home.installApp");

  useEffect(() => {
    // Don't show inside Capacitor native app
    if (typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform?.()) {
      return;
    }

    // Only show on Android devices
    const isAndroid = /android/i.test(navigator.userAgent);
    if (!isAndroid) return;

    // Don't show if previously dismissed
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) return;

    // Don't show if no APK URL configured
    if (!process.env.NEXT_PUBLIC_APK_URL) return;

    setShow(true);
  }, []);

  if (!show) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setShow(false);
  };

  return (
    <section className="bg-primary/10 border-b border-primary/20">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-primary/20">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{t("title")}</p>
              <p className="text-xs text-muted-foreground truncate">
                {t("description")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" asChild>
              <a href={process.env.NEXT_PUBLIC_APK_URL} download>
                {t("download")}
              </a>
            </Button>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-full hover:bg-accent transition-colors"
              aria-label={t("dismiss")}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
