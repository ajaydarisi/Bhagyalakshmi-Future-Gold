"use client";

import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Home, LayoutGrid, Heart, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useWishlist } from "@/hooks/use-wishlist";
import { useAuth } from "@/hooks/use-auth";
// import { ProductSearch } from "@/components/products/product-search";
import { ROUTES } from "@/lib/constants";
import { hapticImpact } from "@/lib/haptics";
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { fetchWishlistProducts } from "@/lib/queries/products";

const HIDDEN_ROUTES = ["/checkout", "/admin"];

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { items: wishlistItems } = useWishlist();
  const { user } = useAuth();
  // const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();

  const handlePrefetch = useCallback(
    (key: string) => {
      if (key === "wishlist" && user) {
        queryClient.prefetchQuery({
          queryKey: queryKeys.wishlist.products(user.id),
          queryFn: () => fetchWishlistProducts(user.id),
          staleTime: 60 * 1000,
        });
      }
    },
    [user, queryClient]
  );

  if (HIDDEN_ROUTES.some((r) => pathname.startsWith(r))) return null;

  const tabs = [
    { key: "home", href: ROUTES.home, icon: Home, label: t("home") },
    { key: "shop", href: ROUTES.products, icon: LayoutGrid, label: t("shop") },
    // { key: "search", href: null, icon: Search, label: t("search") },
    {
      key: "wishlist",
      href: ROUTES.wishlist,
      icon: Heart,
      label: t("wishlist"),
      badge: wishlistItems.length,
    },
    {
      key: "account",
      href: user ? ROUTES.account : ROUTES.login,
      icon: User,
      label: t("account"),
    },
  ] as const;

  function isActive(key: string, href: string | null) {
    if (key === "home") return pathname === "/";
    if (!href) return false;
    return pathname.startsWith(href);
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/80 backdrop-blur-lg lg:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex h-16 items-center justify-around px-2">
          {tabs.map((tab) => {
            const active = isActive(tab.key, tab.href);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.key}
                href={tab.href!}
                onClick={() => hapticImpact("light")}
                onTouchStart={() => handlePrefetch(tab.key)}
                className={`relative flex flex-col items-center justify-center gap-0.5 px-3 py-1 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon
                  className="h-5 w-5"
                  strokeWidth={active ? 2 : 1.5}
                  fill={active ? "currentColor" : "none"}
                />
                {"badge" in tab && tab.badge > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full p-0 text-[9px] flex items-center justify-center"
                  >
                    {tab.badge}
                  </Badge>
                )}
                <span className={`text-[10px] ${active ? "font-semibold" : ""}`}>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* <ProductSearch open={searchOpen} onOpenChange={setSearchOpen} /> */}
    </>
  );
}
