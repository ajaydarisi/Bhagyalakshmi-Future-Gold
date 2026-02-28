"use client";

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import {
  ShoppingBag,
  Search,
  Heart,
  User,
  LogOut,
  Package,
  MapPin,
  LayoutDashboard,
  Languages,
  Sun,
  Moon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, IS_ONLINE, ROUTES } from "@/lib/constants";
import Image from "next/image";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
  user: SupabaseUser | null;
  profile: { full_name: string | null } | null;
  isAdmin: boolean;
  isLoading: boolean;
  wishlistCount: number;
  onSearchOpen: () => void;
  onSignOut: () => void;
  onLangDialogOpen: () => void;
  theme: string | undefined;
  onThemeToggle: () => void;
  pathname: string;
}

export function MobileNav({
  open,
  onOpenChange,
  itemCount,
  user,
  profile,
  isAdmin,
  isLoading,
  wishlistCount,
  onSearchOpen,
  onSignOut,
  onLangDialogOpen,
  theme,
  onThemeToggle,
  pathname,
}: MobileNavProps) {
  const t = useTranslations("nav");
  const tc = useTranslations("constants");
  const tCommon = useTranslations();

  function close() {
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-80 pl-3 flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-left">
            <Image
              src="/images/logo.png"
              alt={tCommon("appName")}
              width={96}
              height={32}
              className="h-8 w-auto rounded-lg"
            />
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto">
          {/* User info */}
          {!isLoading && user && (
            <>
              <div className="px-3 py-2">
                <p className="text-sm font-medium">
                  {profile?.full_name || "User"}
                </p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <Separator />
            </>
          )}

          {/* Categories */}
          <div>
            <h3 className="mb-2 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
              {t("categories")}
            </h3>
            <div className="flex flex-col gap-1">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`${ROUTES.products}?category=${cat.slug}`}
                  onClick={close}
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  {tc(`categories.${cat.slug}`)}
                </Link>
              ))}
            </div>
          </div>

          <Separator />

          {/* Quick links */}
          <div className="flex flex-col gap-1">
            <Link
              href={ROUTES.products}
              onClick={close}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              {t("allProducts")}
            </Link>
            <Link
              href={ROUTES.about}
              onClick={close}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              {t("aboutUs")}
            </Link>
          </div>

          <Separator />

          {/* Actions: Search, Wishlist, Cart */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                close();
                onSearchOpen();
              }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted text-left"
            >
              <Search className="h-4 w-4" strokeWidth={1.5} />
              {t("search")}
            </button>
            <Link
              href={ROUTES.wishlist}
              onClick={close}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Heart className="h-4 w-4" strokeWidth={1.5} />
              {t("wishlist")}
              {wishlistCount > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-auto h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                >
                  {wishlistCount}
                </Badge>
              )}
            </Link>
            {IS_ONLINE && (
              <Link
                href={ROUTES.cart}
                onClick={close}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <ShoppingBag className="h-4 w-4" strokeWidth={1.5} />
                {t("shoppingBag")}
                {itemCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-auto h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                  >
                    {itemCount}
                  </Badge>
                )}
              </Link>
            )}
          </div>

          {/* Account section */}
          {!isLoading && user && (
            <>
              <Separator />
              <div className="flex flex-col gap-1">
                {isAdmin && (
                  <Link
                    href={ROUTES.admin}
                    onClick={close}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    <LayoutDashboard className="h-4 w-4" strokeWidth={1.5} />
                    {t("adminDashboard")}
                  </Link>
                )}
                <Link
                  href={ROUTES.account}
                  onClick={close}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <User className="h-4 w-4" strokeWidth={1.5} />
                  {t("myProfile")}
                </Link>
                {IS_ONLINE && (
                  <Link
                    href={ROUTES.accountOrders}
                    onClick={close}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    <Package className="h-4 w-4" strokeWidth={1.5} />
                    {t("myOrders")}
                  </Link>
                )}
                {IS_ONLINE && (
                  <Link
                    href={ROUTES.accountAddresses}
                    onClick={close}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    <MapPin className="h-4 w-4" strokeWidth={1.5} />
                    {t("addresses")}
                  </Link>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Settings: Language, Theme */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                close();
                onLangDialogOpen();
              }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted text-left"
            >
              <Languages className="h-4 w-4" strokeWidth={1.5} />
              {t("changeLanguage")}
            </button>
            <button
              onClick={() => {
                onThemeToggle();
              }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted text-left"
            >
              <Sun className="h-4 w-4 dark:hidden" strokeWidth={1.5} />
              <Moon className="hidden h-4 w-4 dark:block" strokeWidth={1.5} />
              {theme === "dark" ? t("lightMode") : t("darkMode")}
            </button>
          </div>

          {/* Sign in / Sign out */}
          {!isLoading && (
            <>
              <Separator />
              <div className="flex flex-col gap-1">
                {user ? (
                  <button
                    onClick={() => {
                      close();
                      onSignOut();
                    }}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted text-left text-destructive"
                  >
                    <LogOut className="h-4 w-4" strokeWidth={1.5} />
                    {t("signOut")}
                  </button>
                ) : (
                  <Link
                    href={
                      pathname === "/"
                        ? ROUTES.login
                        : `${ROUTES.login}?redirect=${encodeURIComponent(pathname)}`
                    }
                    onClick={close}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    <User className="h-4 w-4" strokeWidth={1.5} />
                    {t("signIn")}
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
