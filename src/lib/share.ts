import { Capacitor } from "@capacitor/core";

export interface ShareProductOptions {
  title: string;
  text: string;
  url: string;
}

export type ShareResult = "shared" | "copied" | "dismissed" | "failed";

/**
 * Share a product using the best available method:
 * 1. Native share sheet (Capacitor on mobile)
 * 2. Web Share API (modern browsers)
 * 3. Clipboard copy (final fallback)
 */
export async function shareProduct(
  options: ShareProductOptions
): Promise<ShareResult> {
  const { title, text, url } = options;

  // Tier 1: Capacitor native share sheet
  if (Capacitor.isNativePlatform()) {
    try {
      const { Share } = await import("@capacitor/share");
      const result = await Share.share({ title, text, url, dialogTitle: title });
      return result.activityType ? "shared" : "dismissed";
    } catch {
      return "failed";
    }
  }

  // Tier 2: Web Share API
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return "dismissed";
      }
      // Fall through to clipboard
    }
  }

  // Tier 3: Clipboard copy
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}
