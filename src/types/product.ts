import type { Database } from "./database";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
export type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type CategoryInsert = Database["public"]["Tables"]["categories"]["Insert"];

export type CategoryWithChildren = Category & {
  children: Category[];
};

export type ProductWithCategory = Product & {
  category: Pick<Category, "name" | "slug"> | null;
};

export interface ProductFilters {
  category?: string;
  material?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  search?: string;
  type?: "sale" | "rental" | "all";
}

export type SortOption = "newest" | "price-asc" | "price-desc" | "name-asc";
