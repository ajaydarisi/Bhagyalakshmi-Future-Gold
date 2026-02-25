"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useTranslations } from "next-intl";

const DISMISS_KEY = "install-app-banner-dismissed";

function shouldShow(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_SHOW_APP_BANNER !== "true") return false;
  if (!process.env.NEXT_PUBLIC_APK_URL) return false;

  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) return false;

  if (localStorage.getItem(DISMISS_KEY)) return false;
  return true;
}

let snapshot = false;
function subscribe(cb: () => void) {
  snapshot = shouldShow();
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}
function getSnapshot() {
  return snapshot;
}
function getServerSnapshot() {
  return false;
}

export function InstallAppBanner() {
  const show = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const t = useTranslations("home.installApp");

  if (!show) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    snapshot = false;
    window.dispatchEvent(new StorageEvent("storage"));
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
