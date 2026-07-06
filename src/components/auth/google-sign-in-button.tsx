"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/gtag";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

function isPwaStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches &&
    !Capacitor.isNativePlatform()
  );
}

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function buildGoogleAuthUrl(next: string, localePrefix: string): Promise<string> {
  const redirectUri = `${window.location.origin}/auth/google`;
  const rawNonce = generateNonce();
  // Google embeds the nonce as-is in the ID token.
  // Supabase hashes the raw nonce we send and compares it to the nonce in the token.
  // So we send the SHA-256 hash to Google (embedded in token) and the raw nonce to Supabase.
  const hashedNonce = await sha256hex(rawNonce);
  const platform = Capacitor.getPlatform();
  const state = btoa(JSON.stringify({ next, locale_prefix: localePrefix, nonce: rawNonce, platform }));

  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "id_token",
    scope: "openid email profile",
    nonce: hashedNonce,
    state,
    prompt: "select_account",
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

interface GoogleSignInButtonProps {
  label: string;
  errorLabel: string;
}

export function GoogleSignInButton({ label, errorLabel }: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();
  const locale = useLocale();

  async function handleGoogleSignIn() {
    setIsLoading(true);

    const localePrefix = locale === "en" ? "" : `/${locale}`;
    const redirectParam = searchParams.get("redirect");
    const next = redirectParam?.startsWith("/")
      ? redirectParam
      : localePrefix || "/";

    const googleAuthUrl = await buildGoogleAuthUrl(next, localePrefix);

    trackEvent("login", { method: "google" });

    if (Capacitor.isNativePlatform()) {
      Browser.open({ url: googleAuthUrl }).catch(() => {
        toast.error(errorLabel);
        setIsLoading(false);
      });
      // Keep isLoading true — deep link handler navigates when callback completes
    } else if (isPwaStandalone()) {
      // PWA standalone mode — use popup to stay within the installed app
      const popup = window.open(
        googleAuthUrl,
        "google-auth",
        "width=500,height=600,left=100,top=100"
      );

      if (!popup) {
        // Popup blocked — fall back to redirect
        window.location.href = googleAuthUrl;
        return;
      }

      const POLL_MS = 500;
      const TIMEOUT_MS = 120_000;
      const startTime = Date.now();

      const timer = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(timer);
            // Popup closed after callback page exchanged token — reload to pick up session
            window.location.href = next;
            return;
          }
          if (popup.location.origin === window.location.origin) {
            // Popup landed on our callback page — it will exchange the token and close itself
          }
        } catch {
          // Cross-origin — expected while on Google's domain
        }

        if (Date.now() - startTime > TIMEOUT_MS) {
          clearInterval(timer);
          popup.close();
          setIsLoading(false);
        }
      }, POLL_MS);
    } else {
      // Standard web redirect
      window.location.href = googleAuthUrl;
    }
  }

  return (
    <Button
      type="button"
      variant="gold-outline"
      size="bfg-md"
      className="w-full"
      disabled={isLoading}
      onClick={handleGoogleSignIn}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
      )}
      {label}
    </Button>
  );
}
