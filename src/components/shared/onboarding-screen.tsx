"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "@/i18n/routing";
import { Capacitor } from "@capacitor/core";
import { Sun, Moon, Monitor } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const ONBOARDING_KEY = "bfg:onboarding-completed";

export function OnboardingScreen() {
  const [step, setStep] = useState<1 | 2>(1);
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    return Capacitor.isNativePlatform() && !localStorage.getItem(ONBOARDING_KEY);
  });
  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);
  const { setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  if (!show) return null;

  function handleLanguageSelect(locale: string) {
    setSelectedLocale(locale);
    router.replace(pathname, { locale });
    setStep(2);
  }

  function handleThemeSelect(theme: string) {
    setTheme(theme);
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShow(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6">
      {/* Logo */}
      <div className="mb-8">
        <Image
          src="/images/logo.png"
          alt="Bhagyalakshmi Future Gold"
          width={200}
          height={200}
          className="h-32 w-auto rounded-lg"
        />
      </div>

      {step === 1 && (
        <div className="flex w-full max-w-sm flex-col items-center gap-8">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">
              Welcome
            </h1>
            <p className="mt-1 text-lg text-muted-foreground">
              స్వాగతం
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Choose your preferred language
            </p>
          </div>

          <div className="flex w-full flex-col gap-3">
            <button
              onClick={() => handleLanguageSelect("en")}
              className={cn(
                "flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-colors",
                selectedLocale === "en"
                  ? "border-gold-500 bg-[rgb(var(--gold-rgb)/0.1)]"
                  : "border-border hover:border-[var(--border-gold)]"
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--gold-rgb)/0.1)] text-lg font-medium text-gold-700">
                A
              </span>
              <div>
                <p className="font-medium text-foreground">English</p>
                <p className="text-sm text-muted-foreground">Continue in English</p>
              </div>
            </button>

            <button
              onClick={() => handleLanguageSelect("te")}
              className={cn(
                "flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-colors",
                selectedLocale === "te"
                  ? "border-gold-500 bg-[rgb(var(--gold-rgb)/0.1)]"
                  : "border-border hover:border-[var(--border-gold)]"
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--gold-rgb)/0.1)] text-lg font-medium text-gold-700">
                తె
              </span>
              <div>
                <p className="font-medium text-foreground">తెలుగు</p>
                <p className="text-sm text-muted-foreground">తెలుగులో కొనసాగించండి</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex w-full max-w-sm flex-col items-center gap-8">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">
              {selectedLocale === "te" ? "థీమ్ ఎంచుకోండి" : "Choose Theme"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {selectedLocale === "te"
                ? "మీ ఇష్టమైన రూపాన్ని ఎంచుకోండి"
                : "Select your preferred appearance"}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3">
            <button
              onClick={() => handleThemeSelect("light")}
              className="flex items-center gap-4 rounded-xl border-2 border-border p-4 text-left transition-colors hover:border-[var(--border-gold)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Sun className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-foreground">
                  {selectedLocale === "te" ? "లైట్" : "Light"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedLocale === "te" ? "తేలికైన రూపం" : "Bright and clean"}
                </p>
              </div>
            </button>

            <button
              onClick={() => handleThemeSelect("dark")}
              className="flex items-center gap-4 rounded-xl border-2 border-border p-4 text-left transition-colors hover:border-[var(--border-gold)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-200">
                <Moon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-foreground">
                  {selectedLocale === "te" ? "డార్క్" : "Dark"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedLocale === "te" ? "కళ్ళకు సున్నితం" : "Easy on the eyes"}
                </p>
              </div>
            </button>

            <button
              onClick={() => handleThemeSelect("system")}
              className="flex items-center gap-4 rounded-xl border-2 border-border p-4 text-left transition-colors hover:border-[var(--border-gold)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <Monitor className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-foreground">
                  {selectedLocale === "te" ? "సిస్టమ్" : "System"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedLocale === "te"
                    ? "పరికరం సెట్టింగ్‌ను అనుసరించు"
                    : "Follow device setting"}
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="mt-10 flex gap-2">
        <div
          className={cn(
            "h-2 w-2 rounded-full transition-colors",
            step === 1 ? "bg-gold-500" : "bg-border"
          )}
        />
        <div
          className={cn(
            "h-2 w-2 rounded-full transition-colors",
            step === 2 ? "bg-gold-500" : "bg-border"
          )}
        />
      </div>
    </div>
  );
}
