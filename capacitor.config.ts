import type { CapacitorConfig } from "@capacitor/cli";

// Set DEV_SERVER_URL to your LAN IP for live reload dev workflow
// e.g., DEV_SERVER_URL=http://192.168.1.10:3000 npx cap sync android
const devUrl = process.env.DEV_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.bhagyalakshmifuturegold.app",
  appName: "Bhagyalakshmi Future Gold",
  webDir: "public",
  server: {
    url: devUrl || "https://bfg.darisi.in",
    cleartext: !!devUrl,
    errorPath: "offline.html",
    allowNavigation: [
      "bfg.darisi.in",
      "*.supabase.co",
      "checkout.razorpay.com",
      "api.razorpay.com",
      "accounts.google.com",
      "*.google.com",
      "*.googleusercontent.com",
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#7a462e",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#7a462e",
      overlaysWebView: false,
    },
    FirebaseMessaging: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  android: {
    allowMixedContent: !!devUrl,
    webContentsDebuggingEnabled: !!devUrl,
  },
  ios: {
    contentInset: "always",
    allowsLinkPreview: false,
  },
};

export default config;
