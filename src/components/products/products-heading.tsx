"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useFilterLoading } from "./filter-loading-context";

interface ProductsHeadingProps {
  title: string;
  count: number;
  countLabel: string;
}

export function ProductsHeading({ title, countLabel }: ProductsHeadingProps) {
  const { loading, setLoading } = useFilterLoading();
  const searchParams = useSearchParams();
  const prevParams = useRef(searchParams.toString());

  // Reset loading when searchParams change (server re-render complete)
  useEffect(() => {
    const current = searchParams.toString();
    if (prevParams.current !== current) {
      prevParams.current = current;
      setLoading(false);
    }
  }, [searchParams, setLoading]);

  // Safety timeout: auto-reset loading if stuck for more than 5 seconds
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), 5000);
    return () => clearTimeout(timer);
  }, [loading, setLoading]);

  return (
    <div>
      <h1 className="flex items-center gap-2 font-display text-3xl text-text-primary md:text-4xl">
        {title}
        {loading && <Loader2 className="h-5 w-5 animate-spin text-text-gold" />}
      </h1>
      <p className="mt-1 text-sm text-text-secondary">{countLabel}</p>
    </div>
  );
}
