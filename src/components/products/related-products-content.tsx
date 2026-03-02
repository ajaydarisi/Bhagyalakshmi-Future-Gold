"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { fetchRelatedProducts } from "@/lib/queries/products";
import { ProductGrid } from "./product-grid";
import type { ProductWithCategory } from "@/types/product";
import { useTranslations } from "next-intl";

interface RelatedProductsContentProps {
  initialProducts: ProductWithCategory[];
  categoryId: string;
  excludeId: string;
}

export function RelatedProductsContent({
  initialProducts,
  categoryId,
  excludeId,
}: RelatedProductsContentProps) {
  const t = useTranslations("products.detail");

  const { data: products = initialProducts } = useQuery({
    queryKey: queryKeys.products.related(categoryId, excludeId),
    queryFn: () => fetchRelatedProducts(categoryId, excludeId),
    initialData: initialProducts,
    staleTime: 2 * 60 * 1000,
  });

  if (!products || products.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="mb-6 text-xl font-bold">{t("relatedProducts")}</h2>
      <ProductGrid products={products} />
    </section>
  );
}
