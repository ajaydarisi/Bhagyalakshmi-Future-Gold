"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { fetchNewProducts } from "@/lib/queries/products";
import { ProductGrid } from "@/components/products/product-grid";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/brand/section-heading";
import { ROUTES } from "@/lib/constants";
import { Link } from "@/i18n/routing";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProductWithCategory } from "@/types/product";

interface NewArrivalsSectionProps {
  initialProducts: ProductWithCategory[];
}

export function NewArrivalsSection({ initialProducts }: NewArrivalsSectionProps) {
  const t = useTranslations("home");

  const { data: products = initialProducts } = useQuery({
    queryKey: queryKeys.products.new,
    queryFn: fetchNewProducts,
    initialData: initialProducts,
    staleTime: 2 * 60 * 1000,
  });

  if (!products || products.length === 0) return null;

  return (
    <section className="border-t border-b border-[var(--border-sand)]">
      <div className="container mx-auto px-4 py-10 lg:py-20">
        <div className="mb-8 lg:mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-4 bfg-animate">
          <SectionHeading align="left" eyebrow={t("newArrivals.label")} title={t("newArrivals.title")} />
          <Button variant="gold-ghost" size="bfg-sm" className="shrink-0" asChild>
            <Link href={`${ROUTES.products}?sort=newest`}>
              {t("newArrivals.shopNew")}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <ProductGrid products={products} />
      </div>
    </section>
  );
}
