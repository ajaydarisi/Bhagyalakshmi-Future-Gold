"use client";

import { Link, usePathname } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import {
  Search,
  ShoppingBag,
  Heart,
  User,
  LogOut,
  Package,
  MapPin,
  LayoutDashboard,
  Menu,
  Languages,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ProductSearch } from "@/components/products/product-search";
import { useTheme } from "next-themes";
import { locales } from "@/i18n/config";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useWishlist } from "@/hooks/use-wishlist";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, IS_ONLINE, ROUTES } from "@/lib/constants";
import { toast } from "sonner";
import Image from "next/image";
import NextLink from "next/link";

export function Header() {
  const t = useTranslations("nav");
  const tc = useTranslations("constants");
  const tCommon = useTranslations();
  const { user, profile, isAdmin } = useAuth();
  const { itemCount } = useCart();
  const { items: wishlistItems } = useWishlist();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [langDialogOpen, setLangDialogOpen] = useState(false);

  const localeLabels: Record<string, string> = {
    en: "English",
    te: "తెలుగు",
  };

  function switchLocale(newLocale: string) {
    router.replace(pathname, { locale: newLocale });
    setLangDialogOpen(false);
  }

  async function handleSignOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "local" });
      toast.success(tCommon("signedOut"));
      router.push("/");
      router.refresh();
    } catch {
      toast.error(tCommon("error.title"));
      router.refresh();
    }
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          {/* Left: Mobile menu + Logo */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </Button>
            <Link
              href="/"
              className="flex items-center gap-2 font-brand text-xl tracking-wide text-primary"
            >
              {tCommon("appName")}
            </Link>
          </div>

          {/* Center: Navigation (desktop only) */}
          <nav className="hidden lg:flex items-center gap-8">
            <DropdownMenu>
              <DropdownMenuTrigger className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-primary cursor-pointer">
                {t("categories")}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                {CATEGORIES.map((cat) => (
                  <DropdownMenuItem key={cat.slug} asChild>
                    <Link href={`${ROUTES.products}?category=${cat.slug}`}>
                      {tc(`categories.${cat.slug}`)}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={ROUTES.products}>{t("allProducts")}</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link
              href={`${ROUTES.products}?type=rental`}
              className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-primary"
            >
              {t("rentals")}
            </Link>
            <Link
              href={ROUTES.about}
              className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-primary"
            >
              {t("about")}
            </Link>
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Desktop-only actions */}
            <div className="hidden md:flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="h-5 w-5" strokeWidth={1.5} />
              </Button>

              <Button variant="ghost" size="icon" asChild>
                <Link href={ROUTES.wishlist} className="relative">
                  <Heart className="h-5 w-5" strokeWidth={1.5} />
                  {wishlistItems.length > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                    >
                      {wishlistItems.length}
                    </Badge>
                  )}
                </Link>
              </Button>

              {IS_ONLINE && (
                <Button variant="ghost" size="icon" asChild>
                  <Link href={ROUTES.cart} className="relative">
                    <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
                    {itemCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                      >
                        {itemCount}
                      </Badge>
                    )}
                  </Link>
                </Button>
              )}

              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <User className="h-5 w-5" strokeWidth={1.5} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">
                        {profile?.full_name || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                    {isAdmin && (
                      <>
                        <DropdownMenuItem asChild>
                          <NextLink href={ROUTES.admin}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            {t("adminDashboard")}
                          </NextLink>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href={ROUTES.account}>
                        <User className="mr-2 h-4 w-4" />
                        {t("myProfile")}
                      </Link>
                    </DropdownMenuItem>
                    {IS_ONLINE && (
                      <DropdownMenuItem asChild>
                        <Link href={ROUTES.accountOrders}>
                          <Package className="mr-2 h-4 w-4" />
                          {t("myOrders")}
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {IS_ONLINE && (
                      <DropdownMenuItem asChild>
                        <Link href={ROUTES.accountAddresses}>
                          <MapPin className="mr-2 h-4 w-4" />
                          {t("addresses")}
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      {t("signOut")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={pathname === "/" ? ROUTES.login : `${ROUTES.login}?redirect=${encodeURIComponent(pathname)}`}>{t("signIn")}</Link>
                </Button>
              )}
            </div>

            {/* Mobile-only: User dropdown with search/wishlist */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <User className="h-5 w-5" strokeWidth={1.5} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">
                      {profile?.full_name || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  {isAdmin && (
                    <>
                      <DropdownMenuItem asChild>
                        <NextLink href={ROUTES.admin}>
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          {t("adminDashboard")}
                        </NextLink>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href={ROUTES.account}>
                      <User className="mr-2 h-4 w-4" />
                      {t("myProfile")}
                    </Link>
                  </DropdownMenuItem>
                  {IS_ONLINE && (
                    <DropdownMenuItem asChild>
                      <Link href={ROUTES.accountOrders}>
                        <Package className="mr-2 h-4 w-4" />
                        {t("myOrders")}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {IS_ONLINE && (
                    <DropdownMenuItem asChild>
                      <Link href={ROUTES.accountAddresses}>
                        <MapPin className="mr-2 h-4 w-4" />
                        {t("addresses")}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSearchOpen(true)}>
                    <Search className="mr-2 h-4 w-4" />
                    {t("search")}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={ROUTES.wishlist} className="flex items-center">
                      <Heart className="mr-2 h-4 w-4" />
                      {t("wishlist")}
                      {wishlistItems.length > 0 && (
                        <Badge
                          variant="destructive"
                          className="ml-auto h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                        >
                          {wishlistItems.length}
                        </Badge>
                      )}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLangDialogOpen(true)}>
                    <Languages className="mr-2 h-4 w-4" />
                    {t("changeLanguage")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                    <Sun className="mr-2 h-4 w-4 dark:hidden" />
                    <Moon className="mr-2 hidden h-4 w-4 dark:block" />
                    {theme === "dark" ? t("lightMode") : t("darkMode")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t("signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <User className="h-5 w-5" strokeWidth={1.5} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href={pathname === "/" ? ROUTES.login : `${ROUTES.login}?redirect=${encodeURIComponent(pathname)}`}>
                      <User className="mr-2 h-4 w-4" />
                      {t("signIn")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSearchOpen(true)}>
                    <Search className="mr-2 h-4 w-4" />
                    {t("search")}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={ROUTES.wishlist} className="flex items-center">
                      <Heart className="mr-2 h-4 w-4" />
                      {t("wishlist")}
                      {wishlistItems.length > 0 && (
                        <Badge
                          variant="destructive"
                          className="ml-auto h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                        >
                          {wishlistItems.length}
                        </Badge>
                      )}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLangDialogOpen(true)}>
                    <Languages className="mr-2 h-4 w-4" />
                    {t("changeLanguage")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                    <Sun className="mr-2 h-4 w-4 dark:hidden" />
                    <Moon className="mr-2 hidden h-4 w-4 dark:block" />
                    {theme === "dark" ? t("lightMode") : t("darkMode")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      <ProductSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <Dialog open={langDialogOpen} onOpenChange={setLangDialogOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{t("changeLanguage")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {locales.map((loc) => (
              <Button
                key={loc}
                variant={loc === locale ? "default" : "outline"}
                onClick={() => switchLocale(loc)}
                className="w-full"
              >
                {localeLabels[loc]}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <MobileNav
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        itemCount={itemCount}
      />
    </>
  );
}
