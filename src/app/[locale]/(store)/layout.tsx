import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CartProvider } from "@/components/cart/cart-provider";
import { WishlistProvider } from "@/components/wishlist/wishlist-provider";
import { PushTokenLinker } from "@/components/shared/push-token-linker";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { PrefetchProvider } from "@/components/shared/prefetch-provider";
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
            <PrefetchProvider />
            <OfflineBanner />
            <Header />
            <main className="flex-1 pb-20 lg:pb-0">{children}</main>
            <Footer />
            <BottomNav />

          </div>
        </WishlistProvider>
      </CartProvider>
    </NetworkProvider>
  );
}
