import { calculateDiscount } from "@/lib/formatters";
import { PRODUCTS_PER_PAGE, STORE_MODE } from "@/lib/constants";
import type { Category, ProductWithCategory } from "@/types/product";

const FIXTURE_TIMESTAMP = "2026-03-01T00:00:00.000Z";

export const offlineFixtureCategories: Category[] = [
  {
    id: "cat-necklaces",
    parent_id: null,
    name: "Necklaces",
    name_telugu: "నెక్లెస్",
    slug: "necklaces",
    description: null,
    image_url: null,
    sort_order: 1,
    created_at: FIXTURE_TIMESTAMP,
  },
  {
    id: "cat-marriage-rental-sets",
    parent_id: null,
    name: "Marriage Rental Sets",
    name_telugu: "వివాహ అద్దె సెట్లు",
    slug: "marriage-rental-sets",
    description: null,
    image_url: null,
    sort_order: 2,
    created_at: FIXTURE_TIMESTAMP,
  },
];

export const offlineFixtureProducts: ProductWithCategory[] = [
  {
    id: "product-golden-bloom-necklace",
    name: "Golden Bloom Necklace",
    name_telugu: "గోల్డెన్ బ్లూమ్ నెక్లెస్",
    slug: "golden-bloom-necklace",
    description: "A bridal-ready necklace for offline storefront QA.",
    description_telugu: null,
    price: 2500,
    discount_price: 1999,
    category_id: "cat-necklaces",
    stock: 5,
    material: "Gold Plated",
    tags: ["Trending", "New"],
    images: ["/images/hero.png"],
    is_active: true,
    featured: true,
    is_sale: true,
    is_rental: false,
    rental_price: null,
    rental_discount_price: null,
    rental_deposit: null,
    max_rental_days: null,
    set_number: 101,
    created_at: "2026-03-01T00:00:00.000Z",
    updated_at: "2026-03-01T00:00:00.000Z",
    category: {
      name: "Necklaces",
      name_telugu: "నెక్లెస్",
      slug: "necklaces",
    },
  },
  {
    id: "product-lakshmi-coin-haram",
    name: "Lakshmi Coin Haram",
    name_telugu: "లక్ష్మి కాయిన్ హారం",
    slug: "lakshmi-coin-haram",
    description: "An out-of-stock sale product used to verify offline overlays stay hidden.",
    description_telugu: null,
    price: 3200,
    discount_price: null,
    category_id: "cat-necklaces",
    stock: 0,
    material: "Antique",
    tags: ["Best Seller"],
    images: ["/images/hero.png"],
    is_active: true,
    featured: false,
    is_sale: true,
    is_rental: false,
    rental_price: null,
    rental_discount_price: null,
    rental_deposit: null,
    max_rental_days: null,
    set_number: 102,
    created_at: "2026-02-28T00:00:00.000Z",
    updated_at: "2026-02-28T00:00:00.000Z",
    category: {
      name: "Necklaces",
      name_telugu: "నెక్లెస్",
      slug: "necklaces",
    },
  },
  {
    id: "product-temple-bridal-rental-set",
    name: "Temple Bridal Rental Set",
    name_telugu: "టెంపుల్ బ్రైడల్ అద్దె సెట్",
    slug: "temple-bridal-rental-set",
    description: "A rental bridal set used to validate offline availability messaging.",
    description_telugu: null,
    price: 9000,
    discount_price: null,
    category_id: "cat-marriage-rental-sets",
    stock: 2,
    material: "Gold Plated",
    tags: ["Trending"],
    images: ["/images/hero.png"],
    is_active: true,
    featured: true,
    is_sale: false,
    is_rental: true,
    rental_price: 899,
    rental_discount_price: 749,
    rental_deposit: 5000,
    max_rental_days: 5,
    set_number: 201,
    created_at: "2026-03-03T00:00:00.000Z",
    updated_at: "2026-03-03T00:00:00.000Z",
    category: {
      name: "Marriage Rental Sets",
      name_telugu: "వివాహ అద్దె సెట్లు",
      slug: "marriage-rental-sets",
    },
  },
  {
    id: "product-antique-bridal-rental-set",
    name: "Antique Bridal Rental Set",
    name_telugu: "ఆంటీక్ బ్రైడల్ అద్దె సెట్",
    slug: "antique-bridal-rental-set",
    description: "A second rental set used for related-products coverage in offline mode.",
    description_telugu: null,
    price: 11000,
    discount_price: null,
    category_id: "cat-marriage-rental-sets",
    stock: 4,
    material: "Antique",
    tags: ["Limited Edition"],
    images: ["/images/hero.png"],
    is_active: true,
    featured: false,
    is_sale: false,
    is_rental: true,
    rental_price: 1299,
    rental_discount_price: null,
    rental_deposit: 6500,
    max_rental_days: 7,
    set_number: 202,
    created_at: "2026-02-26T00:00:00.000Z",
    updated_at: "2026-02-26T00:00:00.000Z",
    category: {
      name: "Marriage Rental Sets",
      name_telugu: "వివాహ అద్దె సెట్లు",
      slug: "marriage-rental-sets",
    },
  },
];

export function isOfflineE2EFixtureMode() {
  return (
    process.env.NEXT_PUBLIC_E2E_TEST_MODE === "1" &&
    STORE_MODE === "OFFLINE"
  );
}

type OfflineProductFilters = {
  categoryIds: string[];
  materials: string[];
  tags: string[];
  type: string;
  minPrice: number;
  maxPrice: number;
  sort: string;
  page?: number;
  locale?: string;
  search?: string;
};

function getEffectivePrice(product: ProductWithCategory) {
  if (product.is_rental && product.rental_price) {
    return product.rental_discount_price ?? product.rental_price;
  }
  return product.discount_price ?? product.price;
}

function getDiscountPct(product: ProductWithCategory) {
  if (product.is_sale) {
    return calculateDiscount(product.price, product.discount_price) ?? -1;
  }
  if (product.is_rental && product.rental_price) {
    return (
      calculateDiscount(product.rental_price, product.rental_discount_price) ?? -1
    );
  }
  return -1;
}

function matchesSearch(product: ProductWithCategory, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  return [product.name, product.name_telugu, product.description, product.description_telugu]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(query));
}

export function getOfflineFilteredProducts(filters: OfflineProductFilters) {
  const {
    categoryIds,
    materials,
    tags,
    type,
    minPrice,
    maxPrice,
    sort,
    locale = "en",
    search = "",
  } = filters;

  const products = offlineFixtureProducts
    .filter((product) => product.is_active)
    .filter((product) =>
      categoryIds.length === 0 ? true : categoryIds.includes(product.category_id ?? "")
    )
    .filter((product) =>
      materials.length === 0 ? true : materials.includes(product.material ?? "")
    )
    .filter((product) =>
      tags.length === 0 ? true : tags.every((tag) => product.tags.includes(tag))
    )
    .filter((product) => {
      if (type === "sale") return product.is_sale;
      if (type === "rental") return product.is_rental;
      return true;
    })
    .filter((product) => {
      const effectivePrice = getEffectivePrice(product);
      if (minPrice > 0 && effectivePrice < minPrice) return false;
      if (maxPrice > 0 && effectivePrice > maxPrice) return false;
      return matchesSearch(product, search);
    });

  const sortedProducts = [...products];

  switch (sort) {
    case "price-asc":
      sortedProducts.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
      break;
    case "price-desc":
      sortedProducts.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
      break;
    case "name-asc":
      sortedProducts.sort((a, b) => {
        const left = locale === "te" ? a.name_telugu ?? a.name : a.name;
        const right = locale === "te" ? b.name_telugu ?? b.name : b.name;
        return left.localeCompare(right);
      });
      break;
    case "discount":
      sortedProducts.sort((a, b) => getDiscountPct(b) - getDiscountPct(a));
      break;
    default:
      sortedProducts.sort((a, b) => b.created_at.localeCompare(a.created_at));
      break;
  }

  return sortedProducts;
}

export function getOfflineProductCount(filters: OfflineProductFilters) {
  return getOfflineFilteredProducts(filters).length;
}

export function getOfflinePagedProducts(filters: OfflineProductFilters) {
  const page = filters.page ?? 1;
  const from = (page - 1) * PRODUCTS_PER_PAGE;
  const to = from + PRODUCTS_PER_PAGE;
  return getOfflineFilteredProducts(filters).slice(from, to);
}

export function getOfflineFeaturedProducts() {
  return offlineFixtureProducts.filter((product) => product.featured).slice(0, 8);
}

export function getOfflineNewProducts() {
  return [...offlineFixtureProducts]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 4);
}

export function getOfflineProductBySlug(slug: string) {
  return offlineFixtureProducts.find((product) => product.slug === slug) ?? null;
}

export function getOfflineRelatedProducts(categoryId: string, excludeId: string) {
  return offlineFixtureProducts
    .filter((product) => product.category_id === categoryId && product.id !== excludeId)
    .slice(0, 4);
}

export function getOfflineStaticProductSlugs() {
  return offlineFixtureProducts.map((product) => ({ slug: product.slug }));
}
