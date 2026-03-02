"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { initPushNotifications } from "@/lib/push-notifications";
import { startBackgroundTask } from "@/lib/background-task";

export function CapacitorInit() {
  // Send Supabase config to service worker for background sync
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({
          type: "CONFIG",
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        });
      });
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: "#b8860b" }).catch(() => {});
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});

    SplashScreen.hide().catch(() => {});

    // Initialize push notifications
    initPushNotifications().catch(console.error);

    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    // Dispatch app-resume event on foreground, start background task on background
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        window.dispatchEvent(new CustomEvent("bfg:app-resume"));
      } else {
        startBackgroundTask().catch(() => {});
      }
    });

    App.addListener("appUrlOpen", ({ url }) => {
      // Handle Google OAuth custom-scheme fallback (when App Links didn't intercept)
      // Must be checked before the generic /auth/google check below
      if (url.startsWith("bhagyalakshmifuturegold://auth/google-callback")) {
        Browser.close().catch(() => {});
        const parsed = new URL(url);
        const idToken = parsed.searchParams.get("id_token");
        const state = parsed.searchParams.get("state");
        // Navigate to the auth/google page in the WebView with the credentials
        // so the token exchange happens within the app's cookie context
        window.location.href = `${window.location.origin}/auth/google#id_token=${encodeURIComponent(idToken || "")}&state=${encodeURIComponent(state || "")}`;
        return;
      }

      // Handle Google OAuth callback via App Links (direct ID token flow)
      if (url.includes("/auth/google")) {
        Browser.close().catch(() => {});
        const parsed = new URL(url);
        // Preserve hash fragment — it contains the id_token from Google
        window.location.href = `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
        return;
      }

      // Handle legacy Supabase OAuth deep link callbacks (HTTPS or custom scheme)
      if (
        url.includes("/api/auth/callback") ||
        url.startsWith("bhagyalakshmifuturegold://auth")
      ) {
        Browser.close().catch(() => {});
        // Navigate the webview to the callback URL so the server
        // can exchange the auth code and set the session
        const parsed = new URL(url);
        window.location.href = `${window.location.origin}${parsed.pathname}${parsed.search}`;
        return;
      }

      // Handle product deep links (bfg.darisi.in/products/... or /preview/...)
      const productMatch = url.match(
        /bfg\.darisi\.in\/(products|preview)\/([a-z0-9-]+)/
      );
      if (productMatch) {
        window.location.href = `${window.location.origin}/products/${productMatch[2]}`;
        return;
      }
    });

    return () => {
      App.removeAllListeners();
    };
  }, []);

  return null;
}
