import { ExternalLink } from "@/components/shared/external-link";
import { ShopImage } from "@/components/shared/shop-image";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  APP_DESCRIPTION,
  BUSINESS_INFO,
  ROUTES,
  SHOP_IMAGES,
} from "@/lib/constants";
import {
  Clock,
  Mail,
  MapPin,
  Phone,
  Shield,
} from "lucide-react";
import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return {
    title: t("label"),
    description: t("tagline"),
  };
}

export default async function AboutPage() {
  const t = await getTranslations("about");
  const address = BUSINESS_INFO.address;
  const formattedAddress = [
    address.street,
    address.city,
    `${address.district} Dist.`,
    address.state,
    address.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL || "https://bfg.darisi.in";

  const faqItems = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
    { q: t("faq.q5"), a: t("faq.a5") },
  ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  const aboutJsonLd = {
    "@context": "https://schema.org",
    "@type": "JewelryStore",
    name: BUSINESS_INFO.name,
    url: SITE_URL,
    telephone: BUSINESS_INFO.phone,
    email: BUSINESS_INFO.email,
    image: `${SITE_URL}/images/logo.png`,
    description: APP_DESCRIPTION,
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: BUSINESS_INFO.address.street,
      addressLocality: BUSINESS_INFO.address.city,
      addressRegion: BUSINESS_INFO.address.state,
      postalCode: BUSINESS_INFO.address.pincode,
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 15.825028,
      longitude: 80.350527,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ],
        opens: "10:00",
        closes: "21:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Sunday",
        opens: "10:00",
        closes: "14:00",
      },
    ],
    founder: {
      "@type": "Person",
      name: BUSINESS_INFO.proprietor.name,
      jobTitle: BUSINESS_INFO.proprietor.title,
    },
    hasMap: BUSINESS_INFO.map.linkUrl,
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {/* Hero Banner */}
      <section id="store-info" className="bg-[var(--bg-page-warm)] py-20 scroll-mt-24">
        <div className="container mx-auto px-4 text-center">
          <p className="bfg-eyebrow mb-2 block">
            {t("label")}
          </p>
          <h1 className="font-display text-4xl md:text-5xl leading-tight max-w-2xl mx-auto">
            <span className="bfg-foil">{t("tagline")}</span>
          </h1>
          <p className="mt-4 text-text-secondary max-w-lg mx-auto">
            {t("mission")}
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section id="our-story" className="container mx-auto px-4 py-20 scroll-mt-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="bfg-eyebrow mb-2 block">
              {t("storyLabel")}
            </p>
            <h2 className="text-3xl md:text-4xl leading-snug">
              {t("storyTitle")}
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-md font-sans">
              {t("storyShort")}
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-md font-sans">
              {t("storyLong")}
            </p>
            <Button variant="gold-outline" className="mt-6" asChild>
              <Link href={ROUTES.products}>{t("shopCollection")}</Link>
            </Button>
          </div>
          <div className="relative aspect-4/5 overflow-hidden bg-muted">
            <ShopImage
              src={SHOP_IMAGES.storefront}
              alt={t("imageAlt.store")}
            />
          </div>
        </div>
      </section>

      {/* Quality & Warranty */}
      <section id="quality-promise" className="bg-[var(--bg-page-warm)] py-20 scroll-mt-24">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <Shield className="h-8 w-8 mx-auto mb-4 text-gold-500" />
          <p className="bfg-eyebrow mb-2 block">
            {t("promiseLabel")}
          </p>
          <h2 className="text-3xl md:text-4xl mb-6">
            {t("promiseTitle")}
          </h2>
          <p className="text-muted-foreground leading-relaxed font-sans">
            {t("qualityProcess")}
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed font-sans">
            {t("warranty")}
          </p>
        </div>
      </section>

      {/* Shop Gallery */}
      <section className="container mx-auto px-4 py-20">
        <div className="mb-12 text-center">
          <p className="bfg-eyebrow mb-2 block">
            {t("spaceLabel")}
          </p>
          <h2 className="text-3xl md:text-4xl">{t("spaceTitle")}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            { src: SHOP_IMAGES.storefront, alt: t("imageAlt.storefront") },
            { src: SHOP_IMAGES.interior, alt: t("imageAlt.interior") },
            {
              src: SHOP_IMAGES.display,
              alt: t("imageAlt.display"),
            },
          ].map((img) => (
            <div
              key={img.src}
              className="relative aspect-4/3 overflow-hidden bg-muted"
            >
              <ShopImage src={img.src} alt={img.alt} />
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-[var(--bg-page-warm)] py-20 scroll-mt-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="mb-12 text-center">
            <p className="bfg-eyebrow mb-2 block">
              {t("faqLabel")}
            </p>
            <h2 className="text-3xl md:text-4xl">{t("faqTitle")}</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, index) => (
              <AccordionItem
                key={index}
                id={`faq-q${index + 1}`}
                value={`faq-${index}`}
                className="scroll-mt-24"
              >
                <AccordionTrigger className="text-left text-base">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground font-sans">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Visit Us */}
      <section id="visit-us" className="border-t scroll-mt-24">
        <div className="container mx-auto px-4 py-20">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <p className="bfg-eyebrow mb-2 block">
                {t("findUsLabel")}
              </p>
              <h2 className="text-3xl md:text-4xl mb-8">{t("findUsTitle")}</h2>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 mt-0.5 shrink-0 text-gold-500" />
                  <div>
                    <p className="text-sm font-medium mb-1">{t("address")}</p>
                    <p className="text-sm text-muted-foreground font-sans">
                      {formattedAddress}
                    </p>
                  </div>
                </div>

                {BUSINESS_INFO.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 mt-0.5 shrink-0 text-gold-500" />
                    <div>
                      <p className="text-sm font-medium mb-1">{t("phone")}</p>
                      <a
                        href={`tel:${BUSINESS_INFO.phone}`}
                        className="text-sm text-muted-foreground font-sans hover:text-gold-500 transition-colors"
                      >
                        {BUSINESS_INFO.phone}
                      </a>
                    </div>
                  </div>
                )}

                {BUSINESS_INFO.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 mt-0.5 shrink-0 text-gold-500" />
                    <div>
                      <p className="text-sm font-medium mb-1">{t("email")}</p>
                      <a
                        href={`mailto:${BUSINESS_INFO.email}`}
                        className="text-sm text-muted-foreground font-sans hover:text-gold-500 transition-colors"
                      >
                        {BUSINESS_INFO.email}
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 mt-0.5 shrink-0 text-gold-500" />
                  <div>
                    <p className="text-sm font-medium mb-1">{t("businessHours")}</p>
                    <p className="text-sm text-muted-foreground font-sans">
                      {t("monSat")}: {BUSINESS_INFO.hours.weekdays}
                    </p>
                    <p className="text-sm text-muted-foreground font-sans">
                      {t("sunday")}: {BUSINESS_INFO.hours.sunday}
                    </p>
                  </div>
                </div>
              </div>

              {BUSINESS_INFO.map.linkUrl && (
                <Button variant="gold-outline" className="mt-8" asChild>
                  <ExternalLink
                    href={BUSINESS_INFO.map.linkUrl}
                    geoUri={`geo:0,0?q=${encodeURIComponent(`${BUSINESS_INFO.name}, ${BUSINESS_INFO.address.street}, ${BUSINESS_INFO.address.city}, ${BUSINESS_INFO.address.state} ${BUSINESS_INFO.address.pincode}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    {t("getDirections")}
                  </ExternalLink>
                </Button>
              )}
            </div>

            <div className="relative aspect-square overflow-hidden bg-muted">
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
                  title={t("mapTitle")}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MapPin className="h-8 w-8 mb-2" />
                  <span className="text-sm font-sans">
                    {t("mapFallbackCity")}
                  </span>
                  <span className="text-xs font-sans mt-1">
                    {t("mapFallbackState")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Proprietor */}
          {BUSINESS_INFO.proprietor.name && (
            <div className="mt-16 pt-12 border-t text-center">
              <p className="bfg-eyebrow mb-2 block">
                {BUSINESS_INFO.proprietor.title}
              </p>
              <p className="text-xl">{BUSINESS_INFO.proprietor.name}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
