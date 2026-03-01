import { ProductGrid } from "@/components/products/product-grid";
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
import { ArrowRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { unstable_cache } from "next/cache";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { getCategoryName } from "@/lib/i18n-helpers";
import dynamic from "next/dynamic";

const Confetti = dynamic(() =>
  import("@/components/shared/confetti").then((m) => m.Confetti),
);

const InstallAppBanner = dynamic(() =>
  import("@/components/shared/install-app-banner").then((m) => m.InstallAppBanner),
);

const getFeaturedProducts = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select("*, category:categories(name, name_telugu, slug)")
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
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select("*, category:categories(name, name_telugu, slug)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(4);
    return data;
  },
  ["new-products"],
  { revalidate: 300 }
);

const getTopCategories = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("categories")
      .select("name, name_telugu, slug")
      .is("parent_id", null)
      .order("sort_order");
    return data;
  },
  ["top-categories"],
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
  const tBrand = await getTranslations("constants.brandStory");
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
    },
  ];

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {process.env.NEXT_PUBLIC_CONFETTI_ENABLED === "true" && <Confetti />}
      {/* Hero Section — Wedding Season */}
      <section className="relative overflow-hidden wedding-hero md:min-h-[70vh]">
        {/* Background image */}
        <Image
          src="/images/hero.png"
          alt="South Indian bridal wedding jewelry set"
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-[70%_30%] md:object-[center_30%] opacity-70 dark:opacity-50 md:opacity-100"
        />
        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-linear-to-t from-white/90 via-white/70 to-white/40 md:bg-linear-to-r md:from-white/70 md:via-0% md:to-transparent dark:from-black/85 dark:via-black/60 dark:to-black/30 md:dark:from-black/80 md:dark:via-black/50 md:dark:to-transparent" />
        {/* Subtle traditional dot pattern overlay */}
        <div className="absolute inset-0 wedding-hero-pattern" />
        {/* Soft vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.05)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.3)_100%)]" />

        <div className="container mx-auto relative px-4 py-8 pb-10 md:py-20 lg:py-24 flex items-center min-h-[inherit]">
          <div className="max-w-xl lg:max-w-2xl text-center lg:text-left">
            {/* Badge */}
            <div className="wedding-ornament justify-center lg:justify-start mb-6 font-bold">
              <span className="text-xs uppercase tracking-[0.25em] text-primary font-sans">
                {t("hero.badge")}
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight text-foreground dark:text-white">
              {t("hero.titleLine1")}
              <br />
              <span className="text-primary">{t("hero.titleLine2")}</span>
            </h1>

            {/* Subheading */}
            <p className="mt-5 text-base md:text-lg text-foreground/85 dark:text-white/85 max-w-xl mx-auto lg:mx-0 font-brand">
              {t("hero.subtitle")}
            </p>

            {/* Description */}
            <p className="mt-3 text-sm md:text-base text-muted-foreground dark:text-white/65 max-w-lg mx-auto lg:mx-0 font-sans">
              {t("hero.description")}
            </p>

            {/* Ornamental divider */}
            <div className="mt-8 flex items-center gap-3 justify-center lg:justify-start">
              <span className="h-px w-12 bg-linear-to-r from-transparent to-primary/60" />
              <span className="text-primary/80 text-lg">✦</span>
              <span className="h-px w-12 bg-linear-to-l from-transparent to-primary/60" />
            </div>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button
                size="lg"
                className="btn-gold-shimmer text-white font-semibold hover:opacity-90 transition-opacity"
                asChild
              >
                <Link href={`${ROUTES.products}?category=marriage-rental-sets`}>
                  {t("hero.shopCollection")}
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary/50 bg-transparent dark:text-white text-primary hover:text-primary hover:bg-primary/10 hover:border-primary/70"
                asChild
              >
                <Link href={`${ROUTES.products}?category=marriage-rental-sets&sort=discount`}>
                  {t("hero.rentalSets")}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Install App Banner — Android only */}
      <InstallAppBanner />

      {/* Categories */}
      <section className="container mx-auto px-4 py-10 lg:py-20">
        <div className="mb-8 lg:mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
            <span className="underline decoration-primary underline-offset-4 decoration-2">{t("categories.label")}</span>
          </p>
          <h2 className="text-3xl md:text-4xl">{t("categories.title")}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(topCategories ?? []).map((cat) => (
            <Link
              key={cat.slug}
              href={`${ROUTES.products}?category=${cat.slug}`}
              className="group relative flex items-center justify-center py-10 px-4 text-center border border-border bg-card transition-all duration-300 hover:border-primary hover:shadow-md"
            >
              <h3 className="text-sm md:text-lg uppercase tracking-[0.15em] font-medium group-hover:text-primary transition-colors">
                {getCategoryName(cat, locale)}
              </h3>
            </Link>
          ))}
        </div>
      </section>

      {/* Brand Story */}
      <section className="py-10 lg:py-20 bg-accent">
        <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
              <span className="underline decoration-primary underline-offset-4 decoration-2">{t("brandStory.label")}</span>
            </p>
            <h2 className="text-3xl md:text-4xl leading-snug">
              <span className="underline decoration-primary underline-offset-4 decoration-2">{t("brandStory.title")}</span>
              <br />
              {t("brandStory.titleLine2")}
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-md font-sans">
              {tBrand("short")}
            </p>
            <Button variant="outline" className="mt-6" asChild>
              <Link href={ROUTES.about}>{t("brandStory.cta")}</Link>
            </Button>
          </div>
          <div className="relative aspect-4/5 overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80"
              alt="Elegant jewellery craftsmanship"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* Featured Products */}
      {featuredProducts && featuredProducts.length > 0 && (
        <section className="container mx-auto px-4 py-10 lg:py-20">
          <div className="mb-8 lg:mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                <span className="underline decoration-primary underline-offset-4 decoration-2">{t("featured.label")}</span>
              </p>
              <h2 className="text-3xl md:text-4xl">{t("featured.title")}</h2>
            </div>
            <Button variant="link" className="text-primary underline-offset-4" asChild>
              <Link href={ROUTES.products}>
                {t("featured.viewAll")}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <ProductGrid
            products={featuredProducts as unknown as ProductWithCategory[]}
          />
        </section>
      )}

      {/* Wishlist CTA — offline only */}
      {!IS_ONLINE && (
        <section className="bg-accent/30">
          <div className="container mx-auto px-4 py-10 lg:py-16 text-center max-w-xl">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
              <span className="underline decoration-primary underline-offset-4 decoration-2">{t("wishlistCta.label")}</span>
            </p>
            <h2 className="text-2xl md:text-3xl leading-snug">
              {t("wishlistCta.title")}
            </h2>
            <p className="mt-3 text-muted-foreground font-sans">
              {t("wishlistCta.description")}
            </p>
            <Button variant="outline" className="mt-6" asChild>
              <Link href={ROUTES.products}>
                {t("wishlistCta.cta")}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* New Arrivals */}
      {newProducts && newProducts.length > 0 && (
        <section className="border-t border-b">
          <div className="container mx-auto px-4 py-10 lg:py-20">
            <div className="mb-8 lg:mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                  <span className="underline decoration-primary underline-offset-4 decoration-2">{t("newArrivals.label")}</span>
                </p>
                <h2 className="text-3xl md:text-4xl">{t("newArrivals.title")}</h2>
              </div>
              <Button variant="link" className="text-primary underline-offset-4" asChild>
                <Link href={`${ROUTES.products}?sort=newest`}>
                  {t("newArrivals.shopNew")}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <ProductGrid
              products={newProducts as unknown as ProductWithCategory[]}
            />
          </div>
        </section>
      )}

      {/* Trust Bar */}
      <section className="container mx-auto px-4 py-10 lg:py-16">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {(IS_ONLINE
            ? [
                { title: t("trustBar.online.shipping"), description: t("trustBar.online.shippingDesc") },
                { title: t("trustBar.online.checkout"), description: t("trustBar.online.checkoutDesc") },
                { title: t("trustBar.online.returns"), description: t("trustBar.online.returnsDesc") },
                { title: t("trustBar.online.quality"), description: t("trustBar.online.qualityDesc") },
              ]
            : [
                { title: t("trustBar.offline.whatsapp"), description: t("trustBar.offline.whatsappDesc") },
                { title: t("trustBar.offline.visit"), description: t("trustBar.offline.visitDesc") },
                { title: t("trustBar.offline.favourites"), description: t("trustBar.offline.favouritesDesc") },
                { title: t("trustBar.offline.quality"), description: t("trustBar.offline.qualityDesc") },
              ]
          ).map((feature) => (
            <div key={feature.title} className="text-center py-4">
              <h3 className="text-xs uppercase tracking-[0.15em] font-medium">
                {feature.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 font-sans">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Visit Us */}
      <section className="border-t">
        <div className="container mx-auto px-4 py-10 lg:py-20">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                <span className="underline decoration-primary underline-offset-4 decoration-2">{t("visitUs.label")}</span>
              </p>
              <h2 className="text-3xl md:text-4xl mb-8">{t("visitUs.title")}</h2>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium mb-1">{tAbout("address")}</p>
                    <p className="text-sm text-muted-foreground font-sans">
                      {[
                        BUSINESS_INFO.address.street,
                        BUSINESS_INFO.address.city,
                        `${BUSINESS_INFO.address.district} Dist.`,
                        BUSINESS_INFO.address.state,
                        BUSINESS_INFO.address.pincode,
                      ].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </div>

                {BUSINESS_INFO.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium mb-1">{tAbout("phone")}</p>
                      <a
                        href={`tel:${BUSINESS_INFO.phone}`}
                        className="text-sm text-muted-foreground font-sans hover:text-primary transition-colors"
                      >
                        {BUSINESS_INFO.phone}
                      </a>
                    </div>
                  </div>
                )}

                {BUSINESS_INFO.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium mb-1">{tAbout("email")}</p>
                      <a
                        href={`mailto:${BUSINESS_INFO.email}`}
                        className="text-sm text-muted-foreground font-sans hover:text-primary transition-colors"
                      >
                        {BUSINESS_INFO.email}
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium mb-1">{tAbout("businessHours")}</p>
                    <p className="text-sm text-muted-foreground font-sans">
                      {tAbout("monSat")}: {BUSINESS_INFO.hours.weekdays}
                    </p>
                    <p className="text-sm text-muted-foreground font-sans">
                      {tAbout("sunday")}: {BUSINESS_INFO.hours.sunday}
                    </p>
                  </div>
                </div>
              </div>

              {BUSINESS_INFO.map.linkUrl && (
                <Button variant="outline" className="mt-8" asChild>
                  <ExternalLink
                    href={BUSINESS_INFO.map.linkUrl}
                    geoUri={`geo:0,0?q=${encodeURIComponent(`${BUSINESS_INFO.name}, ${BUSINESS_INFO.address.street}, ${BUSINESS_INFO.address.city}, ${BUSINESS_INFO.address.state} ${BUSINESS_INFO.address.pincode}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    {tAbout("getDirections")}
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
                  title="Bhagyalakshmi Future Gold location on Google Maps"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MapPin className="h-8 w-8 mb-2" />
                  <span className="text-sm font-sans">
                    {tAbout("mapFallbackCity")}
                  </span>
                  <span className="text-xs font-sans mt-1">
                    {tAbout("mapFallbackState")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
