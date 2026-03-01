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
      <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
        {title}
        {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      </h1>
        <p className="text-sm text-muted-foreground">{countLabel}</p>
    </div>
  );
}
