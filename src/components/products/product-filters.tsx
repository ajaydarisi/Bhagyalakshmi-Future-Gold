"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MATERIALS, PRODUCT_TAGS, PRODUCT_TYPES } from "@/lib/constants";
import { formatPrice } from "@/lib/formatters";
import { getCategoryName } from "@/lib/i18n-helpers";
import { useDebounce } from "@/hooks/use-debounce";
import { useFilterLoading } from "./filter-loading-context";
import { useState, useEffect, useRef } from "react";
import { ChevronDown, X, Search } from "lucide-react";
import type { Category } from "@/types/product";

export interface PendingFilters {
  categories: string[];
  materials: string[];
  tags: string[];
  type: string;
  priceRange: number[];
  search: string;
}

interface ProductFiltersProps {
  categories?: Category[];
  mode?: "immediate" | "deferred";
  onFiltersChange?: (filters: PendingFilters) => void;
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

export function parseList(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export function getFilterCount(searchParams: URLSearchParams): number {
  let count = 0;
  count += parseList(searchParams.get("category")).length;
  count += parseList(searchParams.get("material")).length;
  count += parseList(searchParams.get("tag")).length;
  if (searchParams.get("type")) count++;
  if (Number(searchParams.get("minPrice")) > 0) count++;
  if (Number(searchParams.get("maxPrice")) > 0 && Number(searchParams.get("maxPrice")) < 10000) count++;
  if (searchParams.get("search")) count++;
  return count;
}

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export function ProductFilters({ categories = [], mode = "immediate", onFiltersChange }: ProductFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("products.filters");
  const tc = useTranslations("constants");
  const { setLoading } = useFilterLoading();
  const isDeferred = mode === "deferred";
  const idPrefix = isDeferred ? "mobile-" : "";

  const urlCategories = parseList(searchParams.get("category"));
  const urlMaterials = parseList(searchParams.get("material"));
  const urlTags = parseList(searchParams.get("tag"));
  const urlType = searchParams.get("type") || "";
  const urlMinPrice = Number(searchParams.get("minPrice")) || 0;
  const urlMaxPrice = Number(searchParams.get("maxPrice")) || 10000;
  const urlSearch = searchParams.get("search") || "";

  // In deferred mode, all selections are local state
  const [pendingCategories, setPendingCategories] = useState(urlCategories);
  const [pendingMaterials, setPendingMaterials] = useState(urlMaterials);
  const [pendingTags, setPendingTags] = useState(urlTags);
  const [pendingType, setPendingType] = useState(urlType);
  const [priceRange, setPriceRange] = useState([urlMinPrice, urlMaxPrice]);
  const [searchQuery, setSearchQuery] = useState(urlSearch);
  const debouncedSearch = useDebounce(searchQuery, 400);
  const prevDebouncedSearch = useRef(debouncedSearch);

  // Auto-apply search when debounced value changes (immediate mode only)
  useEffect(() => {
    if (debouncedSearch === prevDebouncedSearch.current) return;
    prevDebouncedSearch.current = debouncedSearch;
    if (isDeferred) return;
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    } else {
      params.delete("search");
    }
    params.delete("page");
    setLoading(true);
    router.push(`?${params.toString()}`);
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps
  const [expandedParents, setExpandedParents] = useState<Set<string>>(() => {
    const set = new Set<string>();
    const cats = isDeferred ? pendingCategories : urlCategories;
    for (const slug of cats) {
      const found = categories.find((c) => c.slug === slug);
      if (found?.parent_id) {
        set.add(found.parent_id);
      } else if (found) {
        set.add(found.id);
      }
    }
    return set;
  });

  // Effective values: deferred reads local state, immediate reads URL
  const currentCategories = isDeferred ? pendingCategories : urlCategories;
  const currentMaterials = isDeferred ? pendingMaterials : urlMaterials;
  const currentTags = isDeferred ? pendingTags : urlTags;
  const currentType = isDeferred ? pendingType : urlType;

  const categoryTree = buildCategoryTree(categories);
  const groupedParents = categoryTree.filter((p) => p.children.length > 0);
  const standaloneParents = categoryTree.filter((p) => p.children.length === 0);

  // Notify parent of filter changes in deferred mode
  function notifyChange(overrides: Partial<PendingFilters>) {
    if (isDeferred && onFiltersChange) {
      onFiltersChange({
        categories: pendingCategories,
        materials: pendingMaterials,
        tags: pendingTags,
        type: pendingType,
        priceRange,
        search: searchQuery,
        ...overrides,
      });
    }
  }

  function toggleCategory(slug: string) {
    if (isDeferred) {
      const next = toggleInList(pendingCategories, slug);
      setPendingCategories(next);
      notifyChange({ categories: next });
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    const next = toggleInList(urlCategories, slug);
    if (next.length > 0) {
      params.set("category", next.join(","));
    } else {
      params.delete("category");
    }
    params.delete("page");
    setLoading(true);
    router.push(`?${params.toString()}`);
  }

  function toggleMaterial(material: string) {
    if (isDeferred) {
      const next = toggleInList(pendingMaterials, material);
      setPendingMaterials(next);
      notifyChange({ materials: next });
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    const next = toggleInList(urlMaterials, material);
    if (next.length > 0) {
      params.set("material", next.join(","));
    } else {
      params.delete("material");
    }
    params.delete("page");
    setLoading(true);
    router.push(`?${params.toString()}`);
  }

  function toggleTag(tag: string) {
    if (isDeferred) {
      const next = toggleInList(pendingTags, tag);
      setPendingTags(next);
      notifyChange({ tags: next });
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    const next = toggleInList(urlTags, tag);
    if (next.length > 0) {
      params.set("tag", next.join(","));
    } else {
      params.delete("tag");
    }
    params.delete("page");
    setLoading(true);
    router.push(`?${params.toString()}`);
  }

  function updateType(value: string) {
    if (isDeferred) {
      setPendingType(value);
      notifyChange({ type: value });
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("type", value);
    } else {
      params.delete("type");
    }
    params.delete("page");
    setLoading(true);
    router.push(`?${params.toString()}`);
  }

  function applyPriceFilter() {
    if (isDeferred) {
      notifyChange({ priceRange });
      return;
    }
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
    setLoading(true);
    router.push(`?${params.toString()}`);
  }

  function clearFilters() {
    if (isDeferred) {
      setPendingCategories([]);
      setPendingMaterials([]);
      setPendingTags([]);
      setPendingType("");
      setPriceRange([0, 10000]);
      setSearchQuery("");
      notifyChange({ categories: [], materials: [], tags: [], type: "", priceRange: [0, 10000], search: "" });
      return;
    }
    setSearchQuery("");
    setLoading(true);
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

  const hasFilters = currentCategories.length > 0 || currentMaterials.length > 0 || currentTags.length > 0 || currentType || searchQuery || (isDeferred ? priceRange[0] > 0 || priceRange[1] < 10000 : urlMinPrice > 0 || urlMaxPrice < 10000);
  const filterCount = getFilterCount(searchParams);

  return (
    <div className="space-y-6">
      {!isDeferred && (
        <>
          <div className="flex items-center justify-between h-6">
            <h2 className="font-semibold">
              {t("title")}{filterCount > 0 && ` (${filterCount})`}
            </h2>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-auto py-2 cursor-pointer text-xs text-muted-foreground"
              >
                <X className="mr-1 h-3 w-3" />
                {t("clearAll")}
              </Button>
            )}
          </div>
          <Separator />
        </>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (isDeferred) notifyChange({ search: e.target.value });
          }}
          className="pl-9 pr-8 h-9"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              if (isDeferred) notifyChange({ search: "" });
            }}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Separator />

      {/* Type: Sale / Rental */}
      <div>
        <h3 className="mb-3 text-sm font-medium">{t("type")}</h3>
        <RadioGroup
          value={currentType || "all"}
          onValueChange={(value) =>
            updateType(value === "all" ? "" : value)
          }
        >
          {PRODUCT_TYPES.map((type) => (
            <div key={type.value} className="flex items-center gap-2">
              <RadioGroupItem value={type.value} id={`${idPrefix}type-${type.value}`} />
              <Label
                htmlFor={`${idPrefix}type-${type.value}`}
                className="text-sm font-normal cursor-pointer"
              >
                {tc(`productTypes.${type.value}`)}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <Separator />

      {/* Tags */}
      <div>
        <h3 className="mb-3 text-sm font-medium">{t("tag")}</h3>
        <div className="space-y-2">
          {PRODUCT_TAGS.map((tag) => (
            <div key={tag} className="flex items-center gap-2">
              <Checkbox
                id={`${idPrefix}tag-${tag}`}
                checked={currentTags.includes(tag)}
                onCheckedChange={() => toggleTag(tag)}
              />
              <Label
                htmlFor={`${idPrefix}tag-${tag}`}
                className="text-sm font-normal"
              >
                {tc(`tags.${tag}`)}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Category — Hierarchical */}
      <div>
        <h3 className="mb-3 text-sm font-medium">{t("category")}</h3>
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
                  id={`${idPrefix}cat-${parent.slug}`}
                  checked={currentCategories.includes(parent.slug)}
                  onCheckedChange={() => toggleCategory(parent.slug)}
                />
                <Label
                  htmlFor={`${idPrefix}cat-${parent.slug}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {getCategoryName(parent, locale)}
                </Label>
              </div>
              {expandedParents.has(parent.id) &&
                parent.children.map((child) => (
                  <div
                    key={child.slug}
                    className="flex items-center gap-2 pl-8 mt-1"
                  >
                    <Checkbox
                      id={`${idPrefix}cat-${child.slug}`}
                      checked={currentCategories.includes(child.slug)}
                      onCheckedChange={() => toggleCategory(child.slug)}
                    />
                    <Label
                      htmlFor={`${idPrefix}cat-${child.slug}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {getCategoryName(child, locale)}
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
                id={`${idPrefix}cat-${cat.slug}`}
                checked={currentCategories.includes(cat.slug)}
                onCheckedChange={() => toggleCategory(cat.slug)}
              />
              <Label
                htmlFor={`${idPrefix}cat-${cat.slug}`}
                className="text-sm font-normal cursor-pointer"
              >
                {getCategoryName(cat, locale)}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Price Range */}
      <div>
        <h3 className="mb-3 text-sm font-medium">{t("priceRange")}</h3>
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
        {!isDeferred && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={applyPriceFilter}
          >
            {t("applyPrice")}
          </Button>
        )}
      </div>

      <Separator />

      {/* Material */}
      <div>
        <h3 className="mb-3 text-sm font-medium">{t("material")}</h3>
        <div className="space-y-2">
          {MATERIALS.map((material) => (
            <div key={material} className="flex items-center gap-2">
              <Checkbox
                id={`${idPrefix}mat-${material}`}
                checked={currentMaterials.includes(material)}
                onCheckedChange={() => toggleMaterial(material)}
              />
              <Label
                htmlFor={`${idPrefix}mat-${material}`}
                className="text-sm font-normal"
              >
                {tc(`materials.${material}`)}
              </Label>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
