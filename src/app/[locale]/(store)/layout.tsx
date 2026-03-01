import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartProvider } from "@/components/cart/cart-provider";
import { WishlistProvider } from "@/components/wishlist/wishlist-provider";
import { PushTokenLinker } from "@/components/shared/push-token-linker";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { NetworkProvider } from "@/hooks/use-network";
import { createClient } from "@/lib/supabase/server";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <NetworkProvider>
      <CartProvider>
        <WishlistProvider>
          <div className="flex min-h-screen flex-col">
            {user && <PushTokenLinker userId={user.id} />}
            <OfflineBanner />
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </WishlistProvider>
      </CartProvider>
    </NetworkProvider>
  );
}
