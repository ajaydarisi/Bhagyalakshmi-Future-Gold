import { ProductGrid } from "@/components/products/product-grid";
import { Button } from "@/components/ui/button";
import { CATEGORIES, ROUTES, BRAND_STORY } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProductWithCategory } from "@/types/product";
import { ArrowRight } from "lucide-react";
import { unstable_cache } from "next/cache";
import Image from "next/image";
import Link from "next/link";

const getFeaturedProducts = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select("*, category:categories(name, slug)")
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
      .select("*, category:categories(name, slug)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(4);
    return data;
  },
  ["new-products"],
  { revalidate: 300 }
);

export default async function HomePage() {
  const [featuredProducts, newProducts] = await Promise.all([
    getFeaturedProducts(),
    getNewProducts(),
  ]);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative h-[70vh] min-h-125 max-h-200 overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=2000&q=90"
          alt="Fashion jewellery collection"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-r from-black/50 via-black/25 to-transparent" />
        <div className="container mx-auto relative h-full flex items-center px-4">
          <div className="max-w-xl text-white">
            <p className="text-xs uppercase tracking-[0.2em] mb-4 text-white/80">
              <span className="underline decoration-white/50 underline-offset-4 decoration-2">New Collection 2026</span>
            </p>
            <h1 className="text-4xl md:text-6xl leading-tight">
              Adorn Your
              <br />
              <span className="underline decoration-white/50 underline-offset-4 decoration-2">Every Moment</span>
            </h1>
            <p className="mt-4 text-base md:text-lg text-white/80 max-w-md font-sans">
              Explore our exquisite collection of fashion jewellery, designed
              to celebrate your unique style.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-white text-neutral-900 hover:bg-white/90"
                asChild
              >
                <Link href={ROUTES.products}>Shop Collection</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white bg-transparent text-white hover:bg-white/10"
                asChild
              >
                <Link href={`${ROUTES.products}?category=jewellery-sets`}>
                  View Sets
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto px-4 py-20">
        <div className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
            <span className="underline decoration-primary underline-offset-4 decoration-2">Explore</span>
          </p>
          <h2 className="text-3xl md:text-4xl">Shop by Category</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`${ROUTES.products}?category=${cat.slug}`}
              className="group relative flex items-center justify-center py-10 px-4 text-center border border-border bg-card transition-all duration-300 hover:border-primary hover:shadow-md"
            >
              <h3 className="text-sm uppercase tracking-[0.15em] font-medium group-hover:text-primary transition-colors">
                {cat.name}
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
              <span className="underline decoration-primary underline-offset-4 decoration-2">Our Story</span>
            </p>
            <h2 className="text-3xl md:text-4xl leading-snug">
              <span className="underline decoration-primary underline-offset-4 decoration-2">Quality-Checked</span> Jewellery,
              <br />
              Rooted in Chirala
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-md font-sans">
              {BRAND_STORY.short}
            </p>
            <Button variant="outline" className="mt-6" asChild>
              <Link href={ROUTES.about}>Our Story</Link>
            </Button>
          </div>
          <div className="relative aspect-4/5 overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1200&q=85"
              alt="Elegant jewellery craftsmanship"
              fill
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
                <span className="underline decoration-primary underline-offset-4 decoration-2">Curated for You</span>
              </p>
              <h2 className="text-3xl md:text-4xl">Featured Pieces</h2>
            </div>
            <Button variant="link" className="text-primary underline-offset-4" asChild>
              <Link href={ROUTES.products}>
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <ProductGrid
            products={featuredProducts as unknown as ProductWithCategory[]}
          />
        </section>
      )}

      {/* New Arrivals */}
      {newProducts && newProducts.length > 0 && (
        <section className="border-t border-b">
          <div className="container mx-auto px-4 py-20">
            <div className="mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                  <span className="underline decoration-primary underline-offset-4 decoration-2">Just Landed</span>
                </p>
                <h2 className="text-3xl md:text-4xl">New Arrivals</h2>
              </div>
              <Button variant="link" className="text-primary underline-offset-4" asChild>
                <Link href={`${ROUTES.products}?sort=newest`}>
                  Shop New
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
          {[
            {
              title: "Complimentary Shipping",
              description: "On orders above \u20B9999",
            },
            {
              title: "Secure Checkout",
              description: "100% secure payments",
            },
            {
              title: "Easy Returns",
              description: "7-day return policy",
            },
            {
              title: "Quality Assured",
              description: "Every piece quality-checked",
            },
          ].map((feature) => (
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
