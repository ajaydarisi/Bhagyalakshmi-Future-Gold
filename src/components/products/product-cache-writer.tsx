"use client";

import { useEffect } from "react";
import { cacheProduct } from "@/lib/product-cache";
import type { ProductWithCategory } from "@/types/product";

export function ProductCacheWriter({
  product,
}: {
  product: ProductWithCategory;
}) {
  useEffect(() => {
    cacheProduct(product);
  }, [product]);

  return null;
}
