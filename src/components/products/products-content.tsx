"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import {
  fetchProducts,
  type FetchProductsParams,
} from "@/lib/queries/products";
import { ProductGrid } from "./product-grid";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { PRODUCTS_PER_PAGE } from "@/lib/constants";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProductWithCategory } from "@/types/product";

interface ProductsContentProps {
  initialProducts: ProductWithCategory[];
  initialCount: number;
  filterParams: FetchProductsParams;
  page: number;
}

export function ProductsContent({
  initialProducts,
  initialCount,
  filterParams,
  page,
}: ProductsContentProps) {
  const t = useTranslations("products.listing");

  const { data } = useQuery({
    queryKey: queryKeys.products.list(
      filterParams as unknown as Record<string, unknown>
    ),
    queryFn: () => fetchProducts(filterParams),
    initialData: { products: initialProducts, count: initialCount },
    staleTime: 60 * 1000,
  });

  const products = data?.products ?? initialProducts;
  const count = data?.count ?? initialCount;
  const totalPages = Math.ceil(count / PRODUCTS_PER_PAGE);

  if (products.length === 0) {
    return (
      <EmptyState
        icon={<Search className="h-16 w-16" />}
        title={t("noProducts")}
        description={t("noProductsDesc")}
        actionLabel={t("clearFilters")}
        actionHref="/products"
      />
    );
  }

  return (
    <>
      <ProductGrid products={products} />
      <div className="mt-8">
        <Pagination currentPage={page} totalPages={totalPages} />
      </div>
    </>
  );
}
