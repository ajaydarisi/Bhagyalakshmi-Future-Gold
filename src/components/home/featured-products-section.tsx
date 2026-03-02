"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { fetchFeaturedProducts } from "@/lib/queries/products";
import { ProductGrid } from "@/components/products/product-grid";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { Link } from "@/i18n/routing";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProductWithCategory } from "@/types/product";

interface FeaturedProductsSectionProps {
  initialProducts: ProductWithCategory[];
}

export function FeaturedProductsSection({ initialProducts }: FeaturedProductsSectionProps) {
  const t = useTranslations("home");

  const { data: products = initialProducts } = useQuery({
    queryKey: queryKeys.products.featured,
    queryFn: fetchFeaturedProducts,
    initialData: initialProducts,
    staleTime: 2 * 60 * 1000,
  });

  if (!products || products.length === 0) return null;

  return (
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
      <ProductGrid products={products} />
    </section>
  );
}
