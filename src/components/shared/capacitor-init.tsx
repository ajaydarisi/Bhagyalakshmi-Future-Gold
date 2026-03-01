"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { initPushNotifications } from "@/lib/push-notifications";

export function CapacitorInit() {
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

    // Dispatch app-resume event for cart/wishlist sync on foreground
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        window.dispatchEvent(new CustomEvent("bfg:app-resume"));
      }
    });

    App.addListener("appUrlOpen", ({ url }) => {
      // Handle OAuth deep link callbacks (HTTPS or custom scheme)
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
