import { ProductCard } from "./product-card";
import type { ProductWithCategory } from "@/types/product";

interface ProductGridProps {
  products: ProductWithCategory[];
}

export function ProductGrid({ products }: ProductGridProps) {
  return (
    <div className="bfg-stagger grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4">
      {products.map((product, i) => (
        <div key={product.id} style={{ "--i": i } as React.CSSProperties}>
          <ProductCard product={product} />
        </div>
      ))}
    </div>
  );
}
