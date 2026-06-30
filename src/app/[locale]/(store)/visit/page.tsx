import { ExternalLink } from "@/components/shared/external-link";
import { ShopImage } from "@/components/shared/shop-image";
import { Button } from "@/components/ui/button";
import { BUSINESS_INFO, SHOP_IMAGES } from "@/lib/constants";
import { Clock, MapPin, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return {
    title: t("findUsTitle"),
    description: t("visitSubtitle"),
  };
}

export default async function VisitPage() {
  const t = await getTranslations("about");
  const a = BUSINESS_INFO.address;
  const formattedAddress = [a.street, a.city, `${a.district} Dist.`, a.state, a.pincode]
    .filter(Boolean)
    .join(", ");
  const telHref = `tel:${BUSINESS_INFO.phone.replace(/\s/g, "")}`;
  const waHref = `https://wa.me/91${BUSINESS_INFO.whatsapp}?text=${encodeURIComponent(t("visitWhatsappMessage"))}`;

  return (
    <div className="pb-12">
      {/* Store hero */}
      <section className="relative aspect-[16/10] w-full overflow-hidden sm:aspect-[21/9]">
        <ShopImage
          src={SHOP_IMAGES.storefront}
          alt="Bhagyalakshmi Future Gold store in Chirala"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgb(28 24 18 / 0.72), transparent 58%)" }}
        />
        <div className="absolute inset-x-0 bottom-0 p-6 text-ivory-50">
          <p className="bfg-eyebrow mb-1 block text-gold-300">{t("findUsLabel")}</p>
          <h1 className="font-display text-3xl leading-tight md:text-4xl">{t("findUsTitle")}</h1>
          <p className="mt-1 max-w-md text-sm text-ivory-100">{t("visitSubtitle")}</p>
        </div>
      </section>

      <div className="container mx-auto grid gap-10 px-4 py-10 md:grid-cols-2">
        {/* Contact details + CTAs */}
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" />
            <div>
              <p className="mb-1 text-sm font-medium">{t("address")}</p>
              <p className="font-sans text-sm text-muted-foreground">{formattedAddress}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" />
            <div>
              <p className="mb-1 text-sm font-medium">{t("phone")}</p>
              <a
                href={telHref}
                className="font-sans text-sm text-muted-foreground transition-colors hover:text-gold-500"
              >
                {BUSINESS_INFO.phone}
              </a>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" />
            <div>
              <p className="mb-1 text-sm font-medium">{t("businessHours")}</p>
              <p className="font-sans text-sm text-muted-foreground">
                {t("monSat")}: {BUSINESS_INFO.hours.weekdays}
              </p>
              <p className="font-sans text-sm text-muted-foreground">
                {t("sunday")}: {BUSINESS_INFO.hours.sunday}
              </p>
            </div>
          </div>

          {/* Primary CTAs — Call + WhatsApp */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button variant="gold" size="bfg-lg" className="flex-1" asChild>
              <a href={telHref}>
                <Phone className="mr-2 h-4 w-4" />
                {t("callStore")}
              </a>
            </Button>
            <Button
              size="bfg-lg"
              className="flex-1 bg-[#006d28] text-white hover:bg-[#1da851]"
              asChild
            >
              <ExternalLink href={waHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                {t("messageWhatsapp")}
              </ExternalLink>
            </Button>
          </div>

          {BUSINESS_INFO.map.linkUrl && (
            <Button variant="gold-outline" className="w-full sm:w-auto" asChild>
              <ExternalLink
                href={BUSINESS_INFO.map.linkUrl}
                geoUri={`geo:0,0?q=${encodeURIComponent(`${BUSINESS_INFO.name}, ${formattedAddress}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MapPin className="mr-2 h-4 w-4" />
                {t("getDirections")}
              </ExternalLink>
            </Button>
          )}
        </div>

        {/* Map */}
        <div className="relative aspect-square overflow-hidden rounded-[var(--radius-bfg-lg)] bg-muted">
          {BUSINESS_INFO.map.embedUrl ? (
            <iframe
              src={BUSINESS_INFO.map.embedUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              title="Bhagyalakshmi Future Gold location on Google Maps"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <MapPin className="mb-2 h-8 w-8" />
              <span className="font-sans text-sm">{t("mapFallbackCity")}</span>
              <span className="mt-1 font-sans text-xs">{t("mapFallbackState")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
