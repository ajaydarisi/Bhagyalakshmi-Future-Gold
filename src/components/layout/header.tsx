"use client";

import { Link, usePathname } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import {
  ShoppingBag,
  Heart,
  User,
  LogOut,
  Package,
  MapPin,
  LayoutDashboard,
  Menu,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
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
import { IS_ONLINE, ROUTES } from "@/lib/constants";
import { getCategoryName } from "@/lib/i18n-helpers";
import type { NavCategory } from "@/lib/queries";
import { toast } from "sonner";
import NextLink from "next/link";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

/** Desktop nav item with the BFG sliding gold underline. */
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative text-xs font-medium uppercase tracking-[0.15em] text-text-secondary transition-colors hover:text-text-gold"
    >
      {children}
      <span className="absolute -bottom-1 left-0 h-px w-0 bg-gold-500 transition-all duration-300 group-hover:w-full" />
    </Link>
  );
}

/** Round ghost icon button with a warm gold hover tint. */
const ICON_BTN = "rounded-full hover:bg-[rgb(var(--gold-deep-rgb)/0.07)]";
/** Maroon count bubble for cart/wishlist. */
const COUNT_BADGE =
  "absolute -top-1 -right-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-maroon-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[var(--surface-card)] shadow-[0_1px_3px_rgb(0_0_0/0.25)]";

export function Header({ categories }: { categories: NavCategory[] }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations();
  const tTrust = useTranslations("home.trustBar");
  const { user, profile, isAdmin, isLoading } = useAuth();
  const { itemCount } = useCart();
  const { items: wishlistItems } = useWishlist();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const themeToggle = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [langDialogOpen, setLangDialogOpen] = useState(false);

  const isMobile = useIsMobile();

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
      {/* Announcement bar */}
      {!isMobile && (<div
        className="flex items-center justify-center gap-2 px-4 py-1.5 text-center text-2xs uppercase tracking-[0.18em] text-ivory-100"
        style={{ background: "var(--grad-ink)" }}
      >
        {IS_ONLINE ? (
          <Sparkles className="size-3 text-gold-300" strokeWidth={1.7} />
        ) : (
          <MapPin className="size-3 text-gold-300" strokeWidth={1.7} />
        )}
        <span className="text-gold-300">
          {IS_ONLINE
            ? `${tTrust("online.shipping")} · ${tTrust("online.shippingDesc")}`
            : `${tTrust("offline.visit")} · ${tTrust("offline.visitDesc")}`}
        </span>
      </div>
      )}

      <header className="sticky top-0 z-50 w-full border-b border-[var(--border-sand)] bg-[var(--surface-card)]/90 backdrop-blur supports-backdrop-filter:bg-[var(--surface-card)]/70">
        <div className="container mx-auto flex h-14 lg:h-18 items-center justify-between px-4">
          {/* Left: Mobile menu + Logo */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label={t("openMenu")}
            >
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </Button>
            <Link href="/" aria-label={tCommon("appName")}>
              <Logo layout="horizontal" size="sm" />
            </Link>
          </div>

          {/* Center: Navigation (desktop only) */}
          <nav className="hidden lg:flex items-center gap-8">
            <DropdownMenu>
              <DropdownMenuTrigger className="group relative text-xs font-medium uppercase tracking-[0.15em] text-text-secondary transition-colors hover:text-text-gold cursor-pointer">
                {t("categories")}
                <span className="absolute -bottom-1 left-0 h-px w-0 bg-gold-500 transition-all duration-300 group-hover:w-full" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                {categories.map((cat) => (
                  <DropdownMenuItem key={cat.slug} asChild>
                    <Link href={`${ROUTES.products}?category=${cat.slug}`}>
                      {getCategoryName(cat, locale)}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={ROUTES.products}>{t("allProducts")}</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <NavLink href={`${ROUTES.products}?type=rental`}>{t("rentals")}</NavLink>
            <NavLink href={ROUTES.about}>{t("about")}</NavLink>
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            {/* Mobile search and cart shortcuts */}
            <Button
              variant="ghost"
              size="icon"
              className={cn("md:hidden h-8 w-8", ICON_BTN)}
              onClick={() => setSearchOpen(true)}
              aria-label={t("search")}
            >
              <Search className="h-4 w-4" strokeWidth={1.7} />
            </Button>
            {IS_ONLINE && (
              <Button variant="ghost" size="icon" className={cn("lg:hidden h-8 w-8", ICON_BTN)} asChild aria-label={t("shoppingBag")}>
                <Link href={ROUTES.cart} className="relative">
                  <ShoppingBag className="h-4 w-4" strokeWidth={1.7} />
                  {itemCount > 0 && <span className={COUNT_BADGE}>{itemCount}</span>}
                </Link>
              </Button>
            )}
            {/* Desktop-only actions */}
            <div className="hidden md:flex items-center gap-1.5">
              <LanguageSwitcher />
              <ThemeToggle />
              <Button variant="ghost" size="icon" className={ICON_BTN} onClick={() => setSearchOpen(true)} aria-label={t("search")}>
                <Search className="h-5 w-5" strokeWidth={1.7} />
              </Button>

              <Button variant="ghost" size="icon" className={ICON_BTN} asChild aria-label={t("wishlist")}>
                <Link href={ROUTES.wishlist} className="relative">
                  <Heart className="h-5 w-5" strokeWidth={1.7} />
                  {wishlistItems.length > 0 && <span className={COUNT_BADGE}>{wishlistItems.length}</span>}
                </Link>
              </Button>

              {IS_ONLINE && (
                <Button variant="ghost" size="icon" className={ICON_BTN} asChild aria-label={t("shoppingBag")}>
                  <Link href={ROUTES.cart} className="relative">
                    <ShoppingBag className="h-5 w-5" strokeWidth={1.7} />
                    {itemCount > 0 && <span className={COUNT_BADGE}>{itemCount}</span>}
                  </Link>
                </Button>
              )}

              {isLoading ? (
                <div className="bfg-skeleton h-9 w-9 rounded-full" />
              ) : user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className={ICON_BTN} aria-label={t("myAccount")}>
                      <User className="h-5 w-5" strokeWidth={1.7} />
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
                <Button variant="gold-ghost" size="bfg-sm" asChild>
                  <Link href={pathname === "/" ? ROUTES.login : `${ROUTES.login}?redirect=${encodeURIComponent(pathname)}`}>{t("signIn")}</Link>
                </Button>
              )}
            </div>

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
                variant={loc === locale ? "gold" : "gold-outline"}
                size="bfg-md"
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
        categories={categories}
        itemCount={itemCount}
        user={user}
        profile={profile}
        isAdmin={isAdmin}
        isLoading={isLoading}
        wishlistCount={wishlistItems.length}
        onSignOut={handleSignOut}
        onLangDialogOpen={() => setLangDialogOpen(true)}
        theme={resolvedTheme}
        onThemeToggle={themeToggle}
        pathname={pathname}
      />
    </>
  );
}
