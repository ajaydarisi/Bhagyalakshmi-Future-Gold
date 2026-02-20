"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Search, Heart, ShoppingBag, Sun, Moon, LogOut, User as UserIcon, LayoutDashboard } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { APP_NAME, CATEGORIES, IS_ONLINE, ROUTES } from "@/lib/constants";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearchOpen: () => void;
  itemCount: number;
  user: User | null;
  profileName: string | null;
  isAdmin: boolean;
  onSignOut: () => void;
}

export function MobileNav({ open, onOpenChange, onSearchOpen, itemCount, user, profileName, isAdmin, onSignOut }: MobileNavProps) {
  const { theme, setTheme } = useTheme();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-80 pl-3">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-left font-heading tracking-wide text-primary">
            <Image src="/images/logo.svg" alt="" width={20} height={20} />
            {APP_NAME}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 flex flex-col gap-4 overflow-y-auto">
          <div>
            <h3 className="mb-2 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
              Categories
            </h3>
            <div className="flex flex-col gap-1">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`${ROUTES.products}?category=${cat.slug}`}
                  onClick={() => onOpenChange(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-1">
            <Link
              href={ROUTES.products}
              onClick={() => onOpenChange(false)}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              All Products
            </Link>
            <Link
              href={ROUTES.about}
              onClick={() => onOpenChange(false)}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              About Us
            </Link>
            <button
              onClick={onSearchOpen}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted text-left"
            >
              <Search className="h-4 w-4" strokeWidth={1.5} />
              Search
            </button>
            <Link
              href={ROUTES.wishlist}
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Heart className="h-4 w-4" strokeWidth={1.5} />
              Wishlist
            </Link>
            {IS_ONLINE && (
              <Link
                href={ROUTES.cart}
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <ShoppingBag className="h-4 w-4" strokeWidth={1.5} />
                Shopping Bag
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
            <Link
              href={ROUTES.account}
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <UserIcon className="h-4 w-4" strokeWidth={1.5} />
              My Account
            </Link>
          </div>

          <Separator />

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted text-left"
          >
            <Sun className="h-4 w-4 dark:hidden" strokeWidth={1.5} />
            <Moon className="hidden h-4 w-4 dark:block" strokeWidth={1.5} />
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>

          <Separator />

          {user ? (
            <div className="flex flex-col gap-1">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{profileName || "User"}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              {isAdmin && (
                <Link
                  href={ROUTES.admin}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <LayoutDashboard className="h-4 w-4" strokeWidth={1.5} />
                  Admin Dashboard
                </Link>
              )}
              <button
                onClick={() => {
                  onOpenChange(false);
                  onSignOut();
                }}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted text-left"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href={ROUTES.login}
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <UserIcon className="h-4 w-4" strokeWidth={1.5} />
              Sign In
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
