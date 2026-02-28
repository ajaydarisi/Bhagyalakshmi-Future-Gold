import { Capacitor } from "@capacitor/core";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";

const API_BASE = typeof window !== "undefined" ? window.location.origin : "";

async function registerToken(token: string, userId?: string) {
  try {
    await fetch(`${API_BASE}/api/notifications/register-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, userId, platform: "android" }),
    });
  } catch (e) {
    console.error("Failed to register push token:", e);
  }
}

export async function initPushNotifications(userId?: string) {
  if (!Capacitor.isNativePlatform()) return;

  const permResult = await FirebaseMessaging.requestPermissions();
  if (permResult.receive !== "granted") return;

  const { token } = await FirebaseMessaging.getToken();
  await registerToken(token, userId);

  // Listen for token refresh
  FirebaseMessaging.addListener("tokenReceived", async ({ token }) => {
    await registerToken(token, userId);
  });

  // Handle notification tap (app opened from notification)
  FirebaseMessaging.addListener(
    "notificationActionPerformed",
    ({ notification }) => {
      const data = notification.data as Record<string, string> | undefined;
      if (data?.url) {
        // Show full-screen loader overlay during navigation
        const overlay = document.createElement("div");
        overlay.style.cssText =
          "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#fff";
        overlay.innerHTML =
          '<div style="width:2rem;height:2rem;border:4px solid #b8860b;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite"></div>';
        const style = document.createElement("style");
        style.textContent = "@keyframes spin{to{transform:rotate(360deg)}}";
        overlay.appendChild(style);
        document.body.appendChild(overlay);

        window.location.href = data.url;
      }
    }
  );

  // Subscribe to broadcast topic
  await FirebaseMessaging.subscribeToTopic({ topic: "all_users" });
}

export async function linkTokenToUser(userId: string) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { token } = await FirebaseMessaging.getToken();
    await registerToken(token, userId);
  } catch (e) {
    console.error("Failed to link push token to user:", e);
  }
}
