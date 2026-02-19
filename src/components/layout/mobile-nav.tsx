"use client";

import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { APP_NAME, CATEGORIES, ROUTES } from "@/lib/constants";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-80">
        <SheetHeader>
          <SheetTitle className="text-left text-primary">
            <span className="text-yellow-600">✦</span> {APP_NAME}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 flex flex-col gap-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              CATEGORIES
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
              href={ROUTES.wishlist}
              onClick={() => onOpenChange(false)}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Wishlist
            </Link>
            <Link
              href={ROUTES.account}
              onClick={() => onOpenChange(false)}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              My Account
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
