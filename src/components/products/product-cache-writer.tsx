"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cacheProduct } from "@/lib/product-cache";
import { queryKeys } from "@/lib/queries/keys";
import type { ProductWithCategory } from "@/types/product";

export function ProductCacheWriter({
  product,
}: {
  product: ProductWithCategory;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    cacheProduct(product);
    queryClient.setQueryData(queryKeys.products.detail(product.slug), product);
  }, [product, queryClient]);

  return null;
}
