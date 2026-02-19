"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CATEGORIES, MATERIALS } from "@/lib/constants";
import { formatPrice } from "@/lib/formatters";
import { useState } from "react";
import { X } from "lucide-react";

export function ProductFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category") || "";
  const currentMaterial = searchParams.get("material") || "";
  const currentMinPrice = Number(searchParams.get("minPrice")) || 0;
  const currentMaxPrice = Number(searchParams.get("maxPrice")) || 10000;

  const [priceRange, setPriceRange] = useState([currentMinPrice, currentMaxPrice]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`?${params.toString()}`);
  }

  function applyPriceFilter() {
    const params = new URLSearchParams(searchParams.toString());
    if (priceRange[0] > 0) {
      params.set("minPrice", priceRange[0].toString());
    } else {
      params.delete("minPrice");
    }
    if (priceRange[1] < 10000) {
      params.set("maxPrice", priceRange[1].toString());
    } else {
      params.delete("maxPrice");
    }
    params.delete("page");
    router.push(`?${params.toString()}`);
  }

  function clearFilters() {
    router.push("/products");
  }

  const hasFilters = currentCategory || currentMaterial || currentMinPrice > 0 || currentMaxPrice < 10000;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Filters</h2>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-auto p-0 text-xs text-muted-foreground"
          >
            <X className="mr-1 h-3 w-3" />
            Clear all
          </Button>
        )}
      </div>

      <Separator />

      {/* Category */}
      <div>
        <h3 className="mb-3 text-sm font-medium">Category</h3>
        <div className="space-y-2">
          {CATEGORIES.map((cat) => (
            <div key={cat.slug} className="flex items-center gap-2">
              <Checkbox
                id={`cat-${cat.slug}`}
                checked={currentCategory === cat.slug}
                onCheckedChange={(checked) =>
                  updateFilter("category", checked ? cat.slug : "")
                }
              />
              <Label
                htmlFor={`cat-${cat.slug}`}
                className="text-sm font-normal"
              >
                {cat.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Price Range */}
      <div>
        <h3 className="mb-3 text-sm font-medium">Price Range</h3>
        <Slider
          value={priceRange}
          onValueChange={setPriceRange}
          min={0}
          max={10000}
          step={100}
          className="mb-3"
        />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{formatPrice(priceRange[0])}</span>
          <span>{formatPrice(priceRange[1])}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 w-full"
          onClick={applyPriceFilter}
        >
          Apply Price
        </Button>
      </div>

      <Separator />

      {/* Material */}
      <div>
        <h3 className="mb-3 text-sm font-medium">Material</h3>
        <div className="space-y-2">
          {MATERIALS.map((material) => (
            <div key={material} className="flex items-center gap-2">
              <Checkbox
                id={`mat-${material}`}
                checked={currentMaterial === material}
                onCheckedChange={(checked) =>
                  updateFilter("material", checked ? material : "")
                }
              />
              <Label
                htmlFor={`mat-${material}`}
                className="text-sm font-normal"
              >
                {material}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
