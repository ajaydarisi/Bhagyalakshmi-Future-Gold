"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

export default function GoogleAuthCallbackPage() {
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    async function handleCallback() {
      // Extract id_token from URL hash fragment (#id_token=...&state=...)
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const idToken = params.get("id_token");
      const stateParam = params.get("state");

      // Decode state to get redirect info and nonce
      let next = "/";
      let nonce: string | undefined;
      if (stateParam) {
        try {
          const state = JSON.parse(atob(stateParam));
          if (typeof state.next === "string" && state.next.startsWith("/")) {
            next = state.next;
          }
          if (typeof state.nonce === "string") {
            nonce = state.nonce;
          }
        } catch {
          // Invalid state, use default redirect
        }
      }

      if (!idToken) {
        console.error("[auth/google] No id_token in hash fragment. Hash:", hash);
        window.location.href = "/login?error=no_token";
        return;
      }

      // If this page loaded in a mobile browser (App Links didn't intercept the redirect),
      // send the credentials back to the native app via custom URL scheme.
      // The app's WebView will do the token exchange so the session is properly established.
      const isAndroid = /Android/i.test(navigator.userAgent);
      if (isAndroid) {
        console.log("[auth/google] Android browser detected, redirecting to native app via custom scheme");
        const appUrl = `bhagyalakshmifuturegold://auth/google-callback?id_token=${encodeURIComponent(idToken)}&state=${encodeURIComponent(stateParam || "")}`;
        window.location.href = appUrl;
        // Fallback: if the app isn't installed, exchange token in browser after a delay
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      console.log("[auth/google] Got id_token, nonce:", !!nonce, "next:", next);

      try {
        const res = await fetch("/api/auth/google-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_token: idToken, nonce, next }),
        });

        const data = await res.json();
        console.log("[auth/google] API response:", data);

        if (data.success) {
          // If opened as a popup (PWA standalone), close self — parent will navigate
          if (window.opener) {
            window.close();
            return;
          }
          window.location.href = data.next || "/";
        } else {
          console.error("[auth/google] Token exchange failed:", data.error);
          window.location.href = `/login?error=${encodeURIComponent(data.error || "auth")}`;
        }
      } catch (err) {
        console.error("[auth/google] Fetch error:", err);
        window.location.href = "/login?error=fetch_failed";
      }
    }

    handleCallback();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
