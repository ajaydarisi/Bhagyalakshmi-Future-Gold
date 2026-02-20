import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { CheckAvailabilityButton } from "@/components/products/check-availability-button";
import { ProductGrid } from "@/components/products/product-grid";
import { ProductImages } from "@/components/products/product-images";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { PriceDisplay } from "@/components/shared/price-display";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { IS_ONLINE, ROUTES } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProductWithCategory } from "@/types/product";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

const getProduct = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, category:categories(name, slug)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  return data;
});

export async function generateStaticParams() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("products")
    .select("slug")
    .eq("is_active", true);
  return (data ?? []).map((p) => ({ slug: p.slug }));
}

export const revalidate = 3600;

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) return { title: "Product Not Found" };

  return {
    title: product.name,
    description: product.description || `Shop ${product.name} at Bhagyalakshmi Future Gold Commerce`,
    openGraph: {
      title: product.name,
      description: product.description || undefined,
      images: product.images[0] ? [product.images[0]] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) notFound();

  // Fetch related products from same category
  const supabase = await createClient();
  const { data: relatedProducts } = await supabase
    .from("products")
    .select("*, category:categories(name, slug)")
    .eq("is_active", true)
    .eq("category_id", product.category_id!)
    .neq("id", product.id)
    .limit(4);

  const typedProduct = product as unknown as ProductWithCategory;

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "Products", href: ROUTES.products },
          ...(typedProduct.category
            ? [
                {
                  label: typedProduct.category.name,
                  href: `${ROUTES.products}?category=${typedProduct.category.slug}`,
                },
              ]
            : []),
          { label: typedProduct.name },
        ]}
      />

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        {/* Images */}
        <ProductImages images={typedProduct.images} name={typedProduct.name} />

        {/* Details */}
        <div className="space-y-6">
          <div>
            {typedProduct.category && (
              <p className="text-sm text-muted-foreground">
                {typedProduct.category.name}
              </p>
            )}
            <h1 className="text-2xl font-bold md:text-3xl">
              {typedProduct.name}
            </h1>
          </div>

          <PriceDisplay
            price={typedProduct.price}
            discountPrice={typedProduct.discount_price}
            size="lg"
          />

          {typedProduct.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {typedProduct.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <Separator />

          {typedProduct.description && (
            <div>
              <h3 className="font-semibold">Description</h3>
              <p className="mt-2 text-muted-foreground whitespace-pre-line">
                {typedProduct.description}
              </p>
            </div>
          )}

          {typedProduct.material && (
            <div>
              <h3 className="font-semibold">Material</h3>
              <p className="mt-1 text-muted-foreground">
                {typedProduct.material}
              </p>
            </div>
          )}

          <div>
            <h3 className="font-semibold">Availability</h3>
            <p className="mt-1">
              {typedProduct.stock > 0 ? (
                <span className="text-green-600">
                  In Stock ({typedProduct.stock} available)
                </span>
              ) : (
                <span className="text-red-600">Out of Stock</span>
              )}
            </p>
          </div>

          <Separator />

          <div className="flex gap-3">
            <div className="flex-1">
              {IS_ONLINE ? (
                <AddToCartButton product={typedProduct} />
              ) : (
                <CheckAvailabilityButton
                  productName={typedProduct.name}
                  productImage={typedProduct.images[0]}
                />
              )}
            </div>
            <WishlistButton productId={typedProduct.id} />
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts && relatedProducts.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-xl font-bold">You May Also Like</h2>
          <ProductGrid
            products={relatedProducts as unknown as ProductWithCategory[]}
          />
        </section>
      )}
    </div>
  );
}
