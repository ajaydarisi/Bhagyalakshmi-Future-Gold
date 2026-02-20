"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MATERIALS, PRODUCT_TYPES } from "@/lib/constants";
import { formatPrice } from "@/lib/formatters";
import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { Category } from "@/types/product";

interface ProductFiltersProps {
  categories?: Category[];
}

function buildCategoryTree(categories: Category[]) {
  const parents = categories
    .filter((c) => !c.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order);
  return parents.map((parent) => ({
    ...parent,
    children: categories
      .filter((c) => c.parent_id === parent.id)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export function ProductFilters({ categories = [] }: ProductFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category") || "";
  const currentMaterial = searchParams.get("material") || "";
  const currentType = searchParams.get("type") || "";
  const currentMinPrice = Number(searchParams.get("minPrice")) || 0;
  const currentMaxPrice = Number(searchParams.get("maxPrice")) || 10000;

  const [priceRange, setPriceRange] = useState([currentMinPrice, currentMaxPrice]);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(() => {
    // Auto-expand the parent that contains the current category
    const set = new Set<string>();
    if (currentCategory) {
      const cat = categories.find((c) => c.slug === currentCategory);
      if (cat?.parent_id) {
        set.add(cat.parent_id);
      } else if (cat) {
        set.add(cat.id);
      }
    }
    return set;
  });

  const categoryTree = buildCategoryTree(categories);
  // Groups (have children) first, standalone (no children) last
  const groupedParents = categoryTree.filter((p) => p.children.length > 0);
  const standaloneParents = categoryTree.filter((p) => p.children.length === 0);

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

  function toggleParent(parentId: string) {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }

  const hasFilters = currentCategory || currentMaterial || currentType || currentMinPrice > 0 || currentMaxPrice < 10000;

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

      {/* Type: Sale / Rental */}
      <div>
        <h3 className="mb-3 text-sm font-medium">Type</h3>
        <RadioGroup
          value={currentType || "all"}
          onValueChange={(value) =>
            updateFilter("type", value === "all" ? "" : value)
          }
        >
          {PRODUCT_TYPES.map((type) => (
            <div key={type.value} className="flex items-center gap-2">
              <RadioGroupItem value={type.value} id={`type-${type.value}`} />
              <Label
                htmlFor={`type-${type.value}`}
                className="text-sm font-normal cursor-pointer"
              >
                {type.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <Separator />

      {/* Category — Hierarchical (groups first, standalone last) */}
      <div>
        <h3 className="mb-3 text-sm font-medium">Category</h3>
        <div className="space-y-1">
          {groupedParents.map((parent) => (
            <div key={parent.slug}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleParent(parent.id)}
                  className="shrink-0 p-0.5"
                >
                  <ChevronDown
                    className={`size-3 text-muted-foreground transition-transform ${
                      expandedParents.has(parent.id) ? "" : "-rotate-90"
                    }`}
                  />
                </button>
                <Checkbox
                  id={`cat-${parent.slug}`}
                  checked={currentCategory === parent.slug}
                  onCheckedChange={(checked) =>
                    updateFilter("category", checked ? parent.slug : "")
                  }
                />
                <Label
                  htmlFor={`cat-${parent.slug}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {parent.name}
                </Label>
              </div>
              {expandedParents.has(parent.id) &&
                parent.children.map((child) => (
                  <div
                    key={child.slug}
                    className="flex items-center gap-2 pl-8 mt-1"
                  >
                    <Checkbox
                      id={`cat-${child.slug}`}
                      checked={currentCategory === child.slug}
                      onCheckedChange={(checked) =>
                        updateFilter("category", checked ? child.slug : "")
                      }
                    />
                    <Label
                      htmlFor={`cat-${child.slug}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {child.name}
                    </Label>
                  </div>
                ))}
            </div>
          ))}
          {standaloneParents.length > 0 && groupedParents.length > 0 && (
            <Separator className="my-2" />
          )}
          {standaloneParents.map((cat) => (
            <div key={cat.slug} className="flex items-center gap-2 pl-5">
              <Checkbox
                id={`cat-${cat.slug}`}
                checked={currentCategory === cat.slug}
                onCheckedChange={(checked) =>
                  updateFilter("category", checked ? cat.slug : "")
                }
              />
              <Label
                htmlFor={`cat-${cat.slug}`}
                className="text-sm font-normal cursor-pointer"
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
