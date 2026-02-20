import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/shared/price-display";
import { IS_ONLINE, ROUTES } from "@/lib/constants";
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
      <div className="relative aspect-3/4 overflow-hidden bg-muted">
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-all duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No Image
          </div>
        )}
        {product.tags.length > 0 && (
          <div className="absolute left-3 top-3 flex flex-col gap-1">
            {product.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-[10px] uppercase tracking-wider font-medium bg-background/80 backdrop-blur-sm border-0"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {IS_ONLINE && product.stock === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
            <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
              Sold Out
            </span>
          </div>
        )}
      </div>
      <div className="space-y-1">
        {product.category && (
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {product.category.name}
          </p>
        )}
        <h3 className="font-sans text-sm font-medium leading-snug group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        <div>
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
