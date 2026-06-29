"use client";

import { Link, usePathname } from "@/i18n/routing";
import { User, Package, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import { getVisibleStoreLinks } from "@/lib/offline-store-ui";
import { useTranslations } from "next-intl";

const allAccountLinks = [
  { href: ROUTES.account, labelKey: "profile" as const, icon: User, onlineOnly: false },
  { href: ROUTES.accountOrders, labelKey: "orders" as const, icon: Package, onlineOnly: true },
  { href: ROUTES.accountAddresses, labelKey: "addresses" as const, icon: MapPin, onlineOnly: true },
];

const accountLinks = getVisibleStoreLinks(allAccountLinks);

export function AccountSidebar() {
  const pathname = usePathname();
  const t = useTranslations("account.sidebar");

  return (
    <nav className="space-y-1">
      {accountLinks.map((link) => {
        const isActive =
          pathname === link.href ||
          (link.href !== ROUTES.account && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-gold-500 text-[var(--text-on-gold)]"
                : "text-text-secondary hover:bg-[rgb(var(--gold-deep-rgb)/0.06)] hover:text-text-primary"
            )}
          >
            <link.icon className="h-4 w-4" />
            {t(link.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

export function AccountMobileNav() {
  const pathname = usePathname();
  const t = useTranslations("account.sidebar");

  return (
    <nav className="flex gap-1 overflow-x-auto md:hidden">
      {accountLinks.map((link) => {
        const isActive =
          pathname === link.href ||
          (link.href !== ROUTES.account && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-gold-500 bg-gold-500 text-[var(--text-on-gold)]"
                : "border-transparent text-text-secondary hover:bg-[rgb(var(--gold-deep-rgb)/0.06)] hover:text-text-primary"
            )}
          >
            <link.icon className="h-4 w-4" />
            {t(link.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
