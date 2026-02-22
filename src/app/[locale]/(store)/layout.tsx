import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartProvider } from "@/components/cart/cart-provider";
import { WishlistProvider } from "@/components/wishlist/wishlist-provider";
import { createClient } from "@/lib/supabase/server";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let wishlistItems: string[] | undefined;
  if (user) {
    const { data } = await supabase
      .from("wishlist_items")
      .select("product_id")
      .eq("user_id", user.id);
    wishlistItems = data?.map((i) => i.product_id) ?? [];
  }

  return (
    <CartProvider>
      <WishlistProvider initialItems={wishlistItems}>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </WishlistProvider>
    </CartProvider>
  );
}
