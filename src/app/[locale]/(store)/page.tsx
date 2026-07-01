import { Button } from "@/components/ui/button";
import {
  APP_DESCRIPTION,
  APP_NAME,
  BUSINESS_INFO,
  IS_ONLINE,
  ROUTES,
} from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProductWithCategory } from "@/types/product";
import { ExternalLink } from "@/components/shared/external-link";
import { SectionHeading } from "@/components/brand/section-heading";
import { FeaturedProductsSection } from "@/components/home/featured-products-section";
import { NewArrivalsSection } from "@/components/home/new-arrivals-section";
import {
  ArrowRight,
  MapPin,
  Truck,
  ShieldCheck,
  Gem,
  MessageCircle,
  Sparkles,
  Check,
} from "lucide-react";
import { unstable_cache } from "next/cache";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { getCategoryName } from "@/lib/i18n-helpers";
import { getTopCategories } from "@/lib/queries";
import { PRODUCT_LIST_FIELDS } from "@/lib/queries/products";
import {
  getOfflineFeaturedProducts,
  getOfflineNewProducts,
  isOfflineE2EFixtureMode,
} from "@/lib/offline-store-fixtures";
import dynamic from "next/dynamic";

const Confetti = dynamic(() =>
  import("@/components/shared/confetti").then((m) => m.Confetti),
);

const InstallAppBanner = dynamic(() =>
  import("@/components/shared/install-app-banner").then((m) => m.InstallAppBanner),
);

const getFeaturedProducts = unstable_cache(
  async () => {
    if (isOfflineE2EFixtureMode()) {
      return getOfflineFeaturedProducts();
    }

    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select(PRODUCT_LIST_FIELDS)
      .eq("is_active", true)
      .eq("featured", true)
      .limit(8);
    return data;
  },
  ["featured-products"],
  { revalidate: 300 }
);

const getNewProducts = unstable_cache(
  async () => {
    if (isOfflineE2EFixtureMode()) {
      return getOfflineNewProducts();
    }

    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select(PRODUCT_LIST_FIELDS)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(4);
    return data;
  },
  ["new-products"],
  { revalidate: 300 }
);

export default async function HomePage() {
  const [featuredProducts, newProducts, topCategories] = await Promise.all([
    getFeaturedProducts(),
    getNewProducts(),
    getTopCategories(),
  ]);

  const locale = await getLocale();
  const t = await getTranslations("home");
  const tAbout = await getTranslations("about");

  const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://bfg.darisi.in";

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: APP_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/images/logo.png`,
      description: APP_DESCRIPTION,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: APP_NAME,
      url: SITE_URL,
      description: APP_DESCRIPTION,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "JewelryStore",
      name: BUSINESS_INFO.name,
      url: SITE_URL,
      telephone: BUSINESS_INFO.phone,
      email: BUSINESS_INFO.email,
      image: `${SITE_URL}/images/logo.png`,
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
      hasMap: BUSINESS_INFO.map.linkUrl,
    },
  ];

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {process.env.NEXT_PUBLIC_CONFETTI_ENABLED === "true" && <Confetti />}
      {/* Hero — editorial split-grid (DS kit composition) */}
      <section className="wedding-hero-pattern relative overflow-hidden" style={{ background: "var(--grad-ivory-warm)" }}>
        {/* lg height fills the viewport below the chrome (announcement+header+app banner ≈ 11rem) so the hero is one screenful; py-10 pads the image top/bottom. */}
        <div className="container mx-auto grid items-center gap-8 px-4 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:min-h-[calc(100dvh-11rem)] lg:py-10">
          {/* Copy */}
          <div className="bfg-animate flex max-w-xl flex-col gap-5">
            <span className="bfg-ornament self-start">
              <span className="bfg-eyebrow">{t("hero.eyebrow")}</span>
            </span>
            <h1 className="font-display text-text-primary" style={{ fontSize: "clamp(3rem, 6vw, 5.25rem)", lineHeight: 1.05 }}>
              {t("hero.titleA")} <span className="bfg-foil">{t("hero.titleB")}</span>
            </h1>
            <p className="max-w-[44ch] text-lg leading-relaxed text-text-secondary">{t("hero.sub")}</p>
            <div className="mt-1 flex flex-wrap gap-3">
              <Button variant="gold" size="bfg-lg" asChild>
                <Link href={`${ROUTES.products}?category=marriage-rental-sets`}>
                  {t("hero.ctaShop")}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="gold-ghost" size="bfg-lg" asChild>
                <Link href={ROUTES.about}>
                  <MapPin className="mr-1 h-4 w-4" />
                  {t("hero.ctaVisit")}
                </Link>
              </Button>
            </div>
            <div className="mt-4 flex gap-6">
              {([["4.9★", t("hero.statReviews")], ["220+", t("hero.statDesigns")], ["100%", t("hero.statChecked")]] as const).map(([big, small]) => (
                <div key={big} className="flex flex-col">
                  <span className="font-display text-2xl text-text-primary">{big}</span>
                  <span className="text-xs text-text-muted">{small}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Media */}
          <div className="bfg-animate relative">
            <div className="relative aspect-4/5 overflow-hidden rounded-[var(--radius-bfg-xl)] border border-[var(--border-gold)] shadow-[var(--shadow-xl)] lg:aspect-square lg:max-h-[calc(100dvh-16rem)]">
              <Image
                src="/images/brand/hero-bridal.png"
                alt={t("imageAlt.heroBridal")}
                fill
                priority
                fetchPriority="high"
                sizes="(max-width: 1024px) 80vw, 45vw"
                className="object-cover object-[82%_22%]"
              />
            </div>
            {/* Floating chip */}
            <div
              className="absolute bottom-5 left-4 flex items-center gap-3 rounded-[var(--radius-bfg-lg)] border border-[var(--border-sand)] p-4 shadow-[var(--shadow-lg)] sm:-left-5"
              style={{ background: "rgb(252 250 246 / 0.92)", backdropFilter: "blur(8px)", animation: "bfg-float 5s var(--ease-soft) infinite" }}
            >
              <span className="grid size-10 place-items-center rounded-full bg-gold-100 text-gold-600">
                <Gem className="size-5" strokeWidth={1.7} />
              </span>
              <div>
                <div className="text-sm font-semibold text-ink-900">{t("hero.chipTitle")}</div>
                <div className="text-xs text-stone-600">{t("hero.chipSub")}</div>
              </div>
            </div>
            {/* Sparkles */}
            {([["8%", "12%", "0s"], ["88%", "20%", "0.6s"], ["80%", "86%", "1.1s"]] as const).map(([l, tp, d], i) => (
              <span
                key={i}
                aria-hidden
                className="pointer-events-none absolute text-gold-400"
                style={{ left: l, top: tp, animation: `bfg-twinkle 2.4s var(--ease-soft) ${d} infinite` }}
              >
                <Sparkles className="size-4" />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Install App Banner — web only; sits at the bottom of the hero */}
      <InstallAppBanner />

      {/* Category strip — circular icon band (DS kit) */}
      <section className="border-y border-[var(--border-sand)] bg-surface-card">
        <div className="container mx-auto px-4 py-8 lg:py-10">
          <div className="bfg-stagger flex flex-wrap justify-center gap-3 sm:gap-6 lg:gap-10">
            {(topCategories ?? []).map((cat, i) => (
              <Link
                key={cat.slug}
                href={`${ROUTES.products}?category=${cat.slug}`}
                style={{ "--i": i } as React.CSSProperties}
                className="group flex flex-col items-center gap-3 rounded-[var(--radius-bfg-lg)] p-3 transition-transform duration-300 hover:-translate-y-1"
              >
                <span
                  className="grid size-16 place-items-center rounded-full border border-[var(--border-gold)] text-gold-700"
                  style={{ background: "var(--grad-gold-soft)" }}
                >
                  <Gem className="size-7" strokeWidth={1.5} />
                </span>
                <span className="text-sm font-medium text-text-primary transition-colors group-hover:text-text-gold">
                  {getCategoryName(cat, locale)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Story band — shop-photo collage + promises (DS kit) */}
      <section className="py-12 lg:py-20">
        <div className="container mx-auto grid items-center gap-10 px-4 md:grid-cols-2">
          {/* Photo collage */}
          <div
            className="bfg-animate grid gap-3"
            style={{ gridTemplateColumns: "1.3fr 1fr", gridTemplateRows: "1fr 1fr", aspectRatio: "1 / 0.92" }}
          >
            <div className="relative row-span-2 overflow-hidden rounded-[var(--radius-bfg-lg)] border border-[var(--border-sand)]">
              <Image src="/images/shop/storefront.jpeg" alt={t("imageAlt.storefront")} fill sizes="(max-width:768px) 60vw, 30vw" className="object-cover" />
            </div>
            <div className="relative overflow-hidden rounded-[var(--radius-bfg-lg)] border border-[var(--border-sand)]">
              <Image src="/images/shop/interior.jpeg" alt={t("imageAlt.interior")} fill sizes="(max-width:768px) 40vw, 20vw" className="object-cover" />
            </div>
            <div className="relative overflow-hidden rounded-[var(--radius-bfg-lg)] border border-[var(--border-sand)]">
              <Image src="/images/shop/display.jpeg" alt={t("imageAlt.display")} fill sizes="(max-width:768px) 40vw, 20vw" className="object-cover" />
            </div>
          </div>
          {/* Copy + promises */}
          <div className="bfg-animate flex flex-col items-start gap-4">
            <span className="bfg-ornament">
              <span className="bfg-eyebrow">{t("story.eyebrow")}</span>
            </span>
            <h2 className="font-display text-3xl md:text-4xl text-text-primary">{t("story.title")}</h2>
            <p className="max-w-[46ch] text-lg leading-relaxed text-text-secondary">{t("story.body")}</p>
            <div className="mt-1 flex flex-col gap-3">
              {[t("story.promise1"), t("story.promise2"), t("story.promise3")].map((p) => (
                <span key={p} className="inline-flex items-center gap-2.5 text-text-body">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-700">
                    <Check className="size-3.5" strokeWidth={2} />
                  </span>
                  {p}
                </span>
              ))}
            </div>
            <Button variant="gold-outline" size="bfg-md" className="mt-2" asChild>
              <Link href={ROUTES.about}>{t("brandStory.cta")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <FeaturedProductsSection
        initialProducts={(featuredProducts ?? []) as unknown as ProductWithCategory[]}
      />

      {/* Wishlist CTA — offline only */}
      {!IS_ONLINE && (
        <section style={{ background: "var(--bg-page-warm)" }}>
          <div className="container mx-auto px-4 py-10 lg:py-16">
            <SectionHeading
              className="mx-auto bfg-animate"
              eyebrow={t("wishlistCta.label")}
              title={t("wishlistCta.title")}
              subtitle={t("wishlistCta.description")}
            />
            <div className="mt-6 flex justify-center">
              <Button variant="gold" size="bfg-md" asChild>
                <Link href={ROUTES.products}>
                  {t("wishlistCta.cta")}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* New Arrivals */}
      <NewArrivalsSection
        initialProducts={(newProducts ?? []) as unknown as ProductWithCategory[]}
      />

      {/* Trust bar — minimal icon + label (DS kit) */}
      <section className="border-y border-[var(--border-sand)]" style={{ background: "var(--bg-page-warm)" }}>
        <div className="container mx-auto grid grid-cols-2 gap-5 px-4 py-6 lg:grid-cols-4">
          {(IS_ONLINE
            ? [
                { icon: Truck, label: t("trustLabels.shipping") },
                { icon: ShieldCheck, label: t("trustLabels.quality") },
                { icon: Gem, label: t("trustLabels.rentals") },
                { icon: Check, label: t("trustLabels.secure") },
              ]
            : [
                { icon: MapPin, label: t("trustLabels.visit") },
                { icon: ShieldCheck, label: t("trustLabels.quality") },
                { icon: Gem, label: t("trustLabels.rentals") },
                { icon: Sparkles, label: t("trustLabels.custom") },
              ]
          ).map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div key={i} className="flex items-center justify-center gap-3">
                <Icon className="size-6 shrink-0 text-gold-600" strokeWidth={1.6} />
                <span className="text-sm font-medium text-text-body">{feature.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Visit band — compact ink card (DS kit): newsletter online / visit CTA offline */}
      <section style={{ background: "var(--surface-card)" }}>
        <div className="container mx-auto px-4 py-12 lg:py-20">
          <div
            className="bfg-animate relative mx-auto flex max-w-[900px] flex-col items-center gap-4 overflow-hidden rounded-[var(--radius-bfg-xl)] px-6 py-12 text-center text-[var(--text-on-dark)] sm:px-8 sm:py-14"
            style={{ background: "var(--grad-ink)" }}
          >
            {IS_ONLINE ? (
              <>
                <span className="bfg-ornament">
                  <span className="font-brand text-xs uppercase tracking-[0.22em] text-gold-300">{t("newsletter.title")}</span>
                </span>
                <h2 className="font-display text-3xl md:text-4xl">{t("newsletter.subtitle")}</h2>
                <div className="mt-2 flex w-[min(420px,90%)] gap-2">
                  <input
                    type="email"
                    placeholder={t("newsletter.emailPlaceholder")}
                    aria-label={t("newsletter.title")}
                    className="h-12 flex-1 rounded-full border border-white/25 bg-white/10 px-5 text-ivory-50 outline-none placeholder:text-white/50 focus:border-gold-400"
                  />
                  <Button variant="gold" size="bfg-md">{t("newsletter.join")}</Button>
                </div>
              </>
            ) : (
              <>
                <span className="bfg-ornament">
                  <span className="font-brand text-xs uppercase tracking-[0.22em] text-gold-300">{t("visitUs.label")}</span>
                </span>
                <h2 className="font-display text-3xl md:text-4xl">{t("visitUs.title")}</h2>
                <p className="max-w-[46ch] text-lg text-[var(--text-on-dark)]/75">
                  {[BUSINESS_INFO.address.street, BUSINESS_INFO.address.city, BUSINESS_INFO.address.state, BUSINESS_INFO.address.pincode]
                    .filter(Boolean)
                    .join(", ")}{" "}
                  · {tAbout("monSat")}: {BUSINESS_INFO.hours.weekdays}
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-3">
                  {BUSINESS_INFO.whatsapp && (
                    <Button variant="gold" size="bfg-md" asChild>
                      <a href={`https://wa.me/91${BUSINESS_INFO.whatsapp}`} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="mr-1 h-4 w-4" />
                        {t("visitUs.whatsapp")}
                      </a>
                    </Button>
                  )}
                  {BUSINESS_INFO.map.linkUrl && (
                    <Button variant="gold-outline" size="bfg-md" className="border-white/30 text-ivory-50 hover:bg-white/10" asChild>
                      <ExternalLink
                        href={BUSINESS_INFO.map.linkUrl}
                        geoUri={`geo:0,0?q=${encodeURIComponent(`${BUSINESS_INFO.name}, ${BUSINESS_INFO.address.city}, ${BUSINESS_INFO.address.state}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MapPin className="mr-1 h-4 w-4" />
                        {tAbout("getDirections")}
                      </ExternalLink>
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
