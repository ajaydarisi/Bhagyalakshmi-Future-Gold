"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Package, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";

const accountLinks = [
  { href: ROUTES.account, label: "Profile", icon: User },
  { href: ROUTES.accountOrders, label: "Orders", icon: Package },
  { href: ROUTES.accountAddresses, label: "Addresses", icon: MapPin },
];

export function AccountSidebar() {
  const pathname = usePathname();

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
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
