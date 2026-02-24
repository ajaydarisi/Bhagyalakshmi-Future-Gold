import { ProductGrid } from "@/components/products/product-grid";
import { Button } from "@/components/ui/button";
import { IS_ONLINE, ROUTES } from "@/lib/constants";
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

  return (
    <div>
      {process.env.NEXT_PUBLIC_CONFETTI_ENABLED === "true" && <Confetti />}
      {/* Hero Section */}
      <section className="relative h-[70vh] min-h-125 max-h-200 overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=1600&q=80"
          alt="Fashion jewellery collection"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-r from-black/50 via-black/25 to-transparent" />
        <div className="container mx-auto relative h-full flex items-center px-4">
          <div className="max-w-xl text-white">
            <p className="text-xs uppercase tracking-[0.2em] mb-4 text-white/80">
              <span className="underline decoration-white/50 underline-offset-4 decoration-2">{t("hero.badge")}</span>
            </p>
            <h1 className="text-4xl md:text-6xl leading-tight">
              {t("hero.titleLine1")}
              <br />
              <span className="underline decoration-white/50 underline-offset-4 decoration-2">{t("hero.titleLine2")}</span>
            </h1>
            <p className="mt-4 text-base md:text-lg text-white/80 max-w-md font-sans">
              {t("hero.subtitle")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-white text-neutral-900 hover:bg-white/90"
                asChild
              >
                <Link href={ROUTES.products}>{t("hero.shopCollection")}</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white bg-transparent text-white hover:bg-white/10"
                asChild
              >
                <Link href={`${ROUTES.products}?category=marriage-rental-sets`}>
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
              <h3 className="text-sm uppercase tracking-[0.15em] font-medium group-hover:text-primary transition-colors">
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
