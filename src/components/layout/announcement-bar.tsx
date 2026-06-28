import { getTranslations } from "next-intl/server";

import { IS_ONLINE } from "@/lib/constants";

/**
 * Slim ink band above the header carrying a single brand message.
 * Online → free-shipping note; Offline → store-visit / WhatsApp note.
 * Gold text on near-black ink, the BFG modern-luxe signature.
 */
export async function AnnouncementBar() {
  const t = await getTranslations("announcement");
  const message = IS_ONLINE ? t("online") : t("offline");

  return (
    <div className="bg-foreground text-background pt-[env(safe-area-inset-top)]">
      <div className="container mx-auto flex h-8 items-center justify-center px-4">
        <p className="bfg-ornament text-[oklch(0.78_0.09_82)] text-center text-[11px] font-medium tracking-[0.18em] uppercase">
          {message}
        </p>
      </div>
    </div>
  );
}
