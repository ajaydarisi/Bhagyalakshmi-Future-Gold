import type { Product } from "./product";

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  /** Rental period (ISO yyyy-MM-dd). Set only for rental-only products. */
  rental_start?: string | null;
  rental_end?: string | null;
}

export interface CartState {
  items: CartItem[];
  isLoading: boolean;
}
