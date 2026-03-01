"use client";

import { usePrefetch } from "@/hooks/use-prefetch";

export function PrefetchProvider() {
  usePrefetch();
  return null;
}
