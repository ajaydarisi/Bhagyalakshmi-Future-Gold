import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/shared/price-display";
import { ROUTES } from "@/lib/constants";
import type { ProductWithCategory } from "@/types/product";

interface ProductCardProps {
  product: ProductWithCategory;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={ROUTES.product(product.slug)}
      className="group block space-y-3"
    >
      <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No Image
          </div>
        )}
        {product.tags.length > 0 && (
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {product.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Badge variant="destructive">Out of Stock</Badge>
          </div>
        )}
      </div>
      <div>
        {product.category && (
          <p className="text-xs text-muted-foreground">
            {product.category.name}
          </p>
        )}
        <h3 className="font-medium leading-tight group-hover:text-primary">
          {product.name}
        </h3>
        <div className="mt-1">
          <PriceDisplay
            price={product.price}
            discountPrice={product.discount_price}
            size="sm"
          />
        </div>
      </div>
    </Link>
  );
}
