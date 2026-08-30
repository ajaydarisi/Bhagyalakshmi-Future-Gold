import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

/**
 * Locale-segment not-found boundary. Without it, notFound() from a store page
 * (a retired product slug, say) fell through to the unlocalized root boundary
 * and the response went out as 200 — a soft 404 that search engines index as a
 * live page. Catching it here also means a Telugu customer gets Telugu, using
 * the common.notFound strings that already existed with nothing rendering them.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="bfg-foil font-display text-7xl font-bold">404</h1>
      <h2 className="mt-4 font-display text-3xl text-text-primary">{t("title")}</h2>
      <p className="mt-2 text-text-secondary">{t("description")}</p>
      <Button variant="gold" size="bfg-md" asChild className="mt-6">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("backToHome")}
        </Link>
      </Button>
    </div>
  );
}
