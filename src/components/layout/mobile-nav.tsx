"use client";

import { Link } from "@/i18n/routing";
import NextLink from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  ShoppingBag,
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
import { Logo } from "@/components/brand/logo";
import { IS_ONLINE, ROUTES } from "@/lib/constants";
import { getCategoryName } from "@/lib/i18n-helpers";
import type { NavCategory } from "@/lib/queries";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const COUNT_BADGE =
  "ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-maroon-500 p-0 text-xs text-white";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: NavCategory[];
  itemCount: number;
  user: SupabaseUser | null;
  profile: { full_name: string | null } | null;
  isAdmin: boolean;
  isLoading: boolean;
  wishlistCount: number;
  onSignOut: () => void;
  onLangDialogOpen: () => void;
  theme: string | undefined;
  onThemeToggle: () => void;
  pathname: string;
}

export function MobileNav({
  open,
  onOpenChange,
  categories,
  itemCount,
  user,
  profile,
  isAdmin,
  isLoading,
  wishlistCount,
  onSignOut,
  onLangDialogOpen,
  theme,
  onThemeToggle,
  pathname,
}: MobileNavProps) {
  const t = useTranslations("nav");
  const locale = useLocale();

  function close() {
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-80 pl-3 flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-left">
            <Logo layout="horizontal" size="sm" />
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
            <h3 className="mb-2 text-[10px] font-medium uppercase tracking-[0.15em] text-text-gold">
              {t("categories")}
            </h3>
            <div className="flex flex-col gap-1">
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`${ROUTES.products}?category=${cat.slug}`}
                  onClick={close}
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-[rgb(var(--gold-deep-rgb)/0.06)]"
                >
                  {getCategoryName(cat, locale)}
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
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-[rgb(var(--gold-deep-rgb)/0.06)]"
            >
              {t("allProducts")}
            </Link>
            <Link
              href={ROUTES.about}
              onClick={close}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-[rgb(var(--gold-deep-rgb)/0.06)]"
            >
              {t("aboutUs")}
            </Link>
          </div>

          <Separator />

          {/* Actions: Wishlist, Cart */}
          <div className="flex flex-col gap-1">
            <Link
              href={ROUTES.wishlist}
              onClick={close}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-[rgb(var(--gold-deep-rgb)/0.06)]"
            >
              <Heart className="h-4 w-4" strokeWidth={1.5} />
              {t("wishlist")}
              {wishlistCount > 0 && <span className={COUNT_BADGE}>{wishlistCount}</span>}
            </Link>
            {IS_ONLINE && (
              <Link
                href={ROUTES.cart}
                onClick={close}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-[rgb(var(--gold-deep-rgb)/0.06)]"
              >
                <ShoppingBag className="h-4 w-4" strokeWidth={1.5} />
                {t("shoppingBag")}
                {itemCount > 0 && <span className={COUNT_BADGE}>{itemCount}</span>}
              </Link>
            )}
          </div>

          {/* Account section */}
          {!isLoading && user && (
            <>
              <Separator />
              <div className="flex flex-col gap-1">
                {/* Plain next/link: /admin lives outside the [locale] tree,
                    so the i18n Link would 404 at /en/admin */}
                {isAdmin && (
                  <NextLink
                    href={ROUTES.admin}
                    onClick={close}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-[rgb(var(--gold-deep-rgb)/0.06)]"
                  >
                    <LayoutDashboard className="h-4 w-4" strokeWidth={1.5} />
                    {t("adminDashboard")}
                  </NextLink>
                )}
                <Link
                  href={ROUTES.account}
                  onClick={close}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-[rgb(var(--gold-deep-rgb)/0.06)]"
                >
                  <User className="h-4 w-4" strokeWidth={1.5} />
                  {t("myProfile")}
                </Link>
                {IS_ONLINE && (
                  <Link
                    href={ROUTES.accountOrders}
                    onClick={close}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-[rgb(var(--gold-deep-rgb)/0.06)]"
                  >
                    <Package className="h-4 w-4" strokeWidth={1.5} />
                    {t("myOrders")}
                  </Link>
                )}
                {IS_ONLINE && (
                  <Link
                    href={ROUTES.accountAddresses}
                    onClick={close}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-[rgb(var(--gold-deep-rgb)/0.06)]"
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
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-[rgb(var(--gold-deep-rgb)/0.06)] text-left"
            >
              <Languages className="h-4 w-4" strokeWidth={1.5} />
              {t("changeLanguage")}
            </button>
            <button
              onClick={() => {
                onThemeToggle();
              }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-[rgb(var(--gold-deep-rgb)/0.06)] text-left"
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
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-[rgb(var(--gold-deep-rgb)/0.06)] text-left text-destructive"
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
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-[rgb(var(--gold-deep-rgb)/0.06)]"
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
