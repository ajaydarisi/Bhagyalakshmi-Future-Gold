import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CartProvider } from "@/components/cart/cart-provider";
import { WishlistProvider } from "@/components/wishlist/wishlist-provider";
import { PushTokenLinker } from "@/components/shared/push-token-linker";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { PrefetchProvider } from "@/components/shared/prefetch-provider";
import { ScrollToTop } from "@/components/shared/scroll-to-top";
import { NetworkProvider } from "@/hooks/use-network";
import { QueryProvider } from "@/components/providers/query-provider";

import { createClient } from "@/lib/supabase/server";
import { getTopCategories } from "@/lib/queries";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [supabaseClient, categories] = await Promise.all([
    createClient(),
    getTopCategories(),
  ]);
  const { data: { user } } = await supabaseClient.auth.getUser();

  return (
    <QueryProvider>
      <NetworkProvider>
        <CartProvider>
          <WishlistProvider>
            <div className="flex min-h-screen flex-col">
              {user && <PushTokenLinker userId={user.id} />}
              <PrefetchProvider />
              <Suspense fallback={null}>
                <ScrollToTop />
              </Suspense>
              <OfflineBanner />
              <Header categories={categories} />
              <main className="flex-1 pb-20 lg:pb-0">{children}</main>
              <Footer categories={categories} />
              <BottomNav />
            </div>
          </WishlistProvider>
        </CartProvider>
      </NetworkProvider>
    </QueryProvider>
  );
}
