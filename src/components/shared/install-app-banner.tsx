"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";

export function InstallAppBanner() {
  const t = useTranslations("home.installApp");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SHOW_APP_BANNER !== "true") return;
    if (!process.env.NEXT_PUBLIC_PLAY_STORE_URL) return;

    const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) return;

    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <section className="relative overflow-hidden bg-background text-foreground py-3 border-y border-border">
      {/* Sleek background effect */}
      <div className="absolute inset-0 bg-linear-to-r from-primary/10 via-transparent to-primary/5 dark:from-primary/20 dark:to-primary/10 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative flex items-center justify-between gap-4 z-10">
        <div className="flex items-center gap-4 min-w-0">
          <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-card border border-border shadow-xs dark:bg-zinc-900/50">
            <Download className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm md:text-base font-semibold tracking-tight text-foreground">{t("title")}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug pr-2">
              {t("description")}
            </p>
          </div>
        </div>
        
        <div className="flex items-center shrink-0">
          <a 
            href={process.env.NEXT_PUBLIC_PLAY_STORE_URL} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-4 py-2 rounded-lg group shadow-sm"
          >
            <svg viewBox="0 0 512 512" className="w-5 h-5 text-primary-foreground group-hover:text-primary-foreground/90 transition-colors" fill="currentColor">
              <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
            </svg>
            <div className="flex flex-col items-start leading-none ml-1">
              <span className="text-[9px] uppercase tracking-wider text-primary-foreground/80 font-medium">GET IT ON</span>
              <span className="text-[13px] font-bold mt-0.5 text-primary-foreground">Google Play</span>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}
