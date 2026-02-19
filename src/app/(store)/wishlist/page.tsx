import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WishlistContent } from "./wishlist-content";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import type { ProductWithCategory } from "@/types/product";

export const metadata: Metadata = {
  title: "Wishlist",
};

export default async function WishlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/wishlist");
  }

  const { data: wishlistItems } = await supabase
    .from("wishlist_items")
    .select("product_id, product:products(*, category:categories(name, slug))")
    .eq("user_id", user.id);

  const products = (wishlistItems || [])
    .map((item) => item.product)
    .filter(Boolean) as unknown as ProductWithCategory[];

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={[{ label: "Wishlist" }]} />
      <h1 className="mt-6 text-2xl font-bold md:text-3xl">My Wishlist</h1>
      <WishlistContent products={products} />
    </div>
  );
}
