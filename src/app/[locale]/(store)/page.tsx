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
import { ArrowRight } from "lucide-react";
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
          className="object-cover object-[70%_30%] md:object-[center_30%] opacity-50 md:opacity-100"
        />
        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/60 to-black/30 md:bg-linear-to-r md:from-black/80 md:via-black/50 md:to-black/10" />
        {/* Subtle traditional dot pattern overlay */}
        <div className="absolute inset-0 wedding-hero-pattern" />
        {/* Soft vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.3)_100%)]" />

        <div className="container mx-auto relative px-4 py-8 pb-10 md:py-20 lg:py-24 flex items-center min-h-[inherit]">
          <div className="max-w-xl lg:max-w-2xl text-center lg:text-left">
            {/* Badge */}
            <div className="wedding-ornament justify-center lg:justify-start mb-6 font-bold">
              <span className="text-xs uppercase tracking-[0.25em] text-primary font-sans">
                {t("hero.badge")}
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight text-white">
              {t("hero.titleLine1")}
              <br />
              <span className="text-primary">{t("hero.titleLine2")}</span>
            </h1>

            {/* Subheading */}
            <p className="mt-5 text-base md:text-lg text-white/85 max-w-xl mx-auto lg:mx-0 font-brand">
              {t("hero.subtitle")}
            </p>

            {/* Description */}
            <p className="mt-3 text-sm md:text-base text-white/65 max-w-lg mx-auto lg:mx-0 font-sans">
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
                className="btn-gold-shimmer text-foreground font-semibold hover:opacity-90 transition-opacity"
                asChild
              >
                <Link href={`${ROUTES.products}?category=marriage-rental-sets`}>
                  {t("hero.shopCollection")}
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary/50 bg-transparent text-white hover:bg-primary/10 hover:border-primary/70"
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
      <section className="container mx-auto px-4 py-20">
        <div className="mb-12 text-center">
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
      <section className="py-20 bg-accent/30">
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
        <section className="container mx-auto px-4 py-20">
          <div className="mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
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
          <div className="container mx-auto px-4 py-16 text-center max-w-xl">
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
          <div className="container mx-auto px-4 py-20">
            <div className="mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
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
      <section className="container mx-auto px-4 py-16">
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
    </div>
  );
}
