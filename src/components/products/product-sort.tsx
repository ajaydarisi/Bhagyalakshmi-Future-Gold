"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SORT_OPTIONS } from "@/lib/constants";
import { useFilterLoading } from "./filter-loading-context";

export function ProductSort() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setLoading } = useFilterLoading();
  const currentSort = searchParams.get("sort") || "newest";
  const t = useTranslations("products.sort");
  const tc = useTranslations("constants");

  function handleSort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.delete("page");
    setLoading(true);
    router.push(`?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <Select value={currentSort} onValueChange={handleSort}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={t("placeholder")} />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {tc(`sortOptions.${option.value}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
