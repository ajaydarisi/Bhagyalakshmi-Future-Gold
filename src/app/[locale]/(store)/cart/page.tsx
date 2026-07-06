"use client";

import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CartItem } from "@/components/cart/cart-item";
import { CartSummary } from "@/components/cart/cart-summary";
import { EmptyState } from "@/components/shared/empty-state";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { useCart } from "@/hooks/use-cart";
import { ROUTES } from "@/lib/constants";
import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";

export default function CartPage() {
  const t = useTranslations("cart");
  const tc = useTranslations();
  const { items, isLoading } = useCart();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--gold-500)] border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={[{ label: t("breadcrumb") }]} homeLabel={tc("breadcrumbHome")} />

      <div className="mt-6">
        <span className="bfg-eyebrow">{t("breadcrumb")}</span>
        <h1 className="mt-1 font-display text-3xl text-text-primary md:text-4xl">{t("title")}</h1>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-8 w-8" strokeWidth={1.7} />}
          title={t("empty")}
          description={t("emptyDescription")}
          actionLabel={t("browseProducts")}
          actionHref={ROUTES.products}
        />
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_350px]">
          <div className="divide-y divide-[var(--border-sand)]">
            {items.map((item) => (
              <CartItem key={item.product.id} item={item} />
            ))}
          </div>

          <div>
            <Card className="border-[var(--border-gold)] shadow-[var(--shadow-md)]">
              <CardContent className="p-6">
                <h2 className="mb-4 font-display text-xl text-text-primary">{t("orderSummary")}</h2>
                <CartSummary />
                <div className="mt-6 space-y-2">
                  <Button variant="gold" className="w-full" size="bfg-lg" asChild>
                    <Link href={ROUTES.checkout}>{t("proceedToCheckout")}</Link>
                  </Button>
                  <Button variant="gold-outline" className="w-full" size="bfg-md" asChild>
                    <Link href={ROUTES.products}>{t("continueShopping")}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
