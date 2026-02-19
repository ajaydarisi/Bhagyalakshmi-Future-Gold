"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PriceDisplay } from "@/components/shared/price-display";
import { EmptyState } from "@/components/shared/empty-state";
import { useWishlist } from "@/hooks/use-wishlist";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import { ROUTES } from "@/lib/constants";
import type { ProductWithCategory } from "@/types/product";

interface WishlistContentProps {
  products: ProductWithCategory[];
}

export function WishlistContent({ products }: WishlistContentProps) {
  const { removeItem } = useWishlist();
  const { addItem } = useCart();

  if (products.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="h-16 w-16" />}
        title="Your wishlist is empty"
        description="Save items you love to your wishlist and they'll show up here."
        actionLabel="Browse Products"
        actionHref={ROUTES.products}
      />
    );
  }

  async function handleMoveToCart(product: ProductWithCategory) {
    await addItem(product, 1);
    await removeItem(product.id);
    toast.success(`${product.name} moved to cart`);
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <div key={product.id} className="group rounded-lg border p-4">
          <Link
            href={ROUTES.product(product.slug)}
            className="relative block aspect-square overflow-hidden rounded-md bg-muted"
          >
            {product.images[0] ? (
              <Image
                src={product.images[0]}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No Image
              </div>
            )}
          </Link>
          <div className="mt-3">
            <Link
              href={ROUTES.product(product.slug)}
              className="font-medium hover:text-primary"
            >
              {product.name}
            </Link>
            <div className="mt-1">
              <PriceDisplay
                price={product.price}
                discountPrice={product.discount_price}
                size="sm"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => handleMoveToCart(product)}
                disabled={product.stock === 0}
              >
                <ShoppingBag className="mr-1 h-3 w-3" />
                {product.stock === 0 ? "Out of Stock" : "Move to Cart"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  removeItem(product.id);
                  toast.success("Removed from wishlist");
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
