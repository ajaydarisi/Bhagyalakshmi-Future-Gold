import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PushTokenLinker } from "@/components/shared/push-token-linker";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { PrefetchProvider } from "@/components/shared/prefetch-provider";
import { ScrollToTop } from "@/components/shared/scroll-to-top";
import { PullToRefresh } from "@/components/shared/pull-to-refresh";
import { BfgAnimate } from "@/components/shared/bfg-animate";

import { createClient, getAuthUser } from "@/lib/supabase/server";
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
  // Local JWT claim read (no network round-trip) — only user.id is needed here.
  const user = await getAuthUser(supabaseClient);

  return (
    <div className="flex min-h-screen flex-col">
      {user && <PushTokenLinker userId={user.id} />}
      <PrefetchProvider />
      <BfgAnimate />
      <Suspense fallback={null}>
        <ScrollToTop />
      </Suspense>
      <OfflineBanner />
      <Header categories={categories} />
      <PullToRefresh>
        <main className="flex-1 pb-20 lg:pb-0">{children}</main>
      </PullToRefresh>
      <Footer categories={categories} />
      <BottomNav />
    </div>
  );
}
