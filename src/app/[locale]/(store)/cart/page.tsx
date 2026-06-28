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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={[{ label: t("breadcrumb") }]} homeLabel={tc("breadcrumbHome")} />

      <h1 className="mt-6 text-2xl font-bold md:text-3xl">{t("title")}</h1>

      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-16 w-16" />}
          title={t("empty")}
          description={t("emptyDescription")}
          actionLabel={t("browseProducts")}
          actionHref={ROUTES.products}
        />
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_350px]">
          <div className="divide-y">
            {items.map((item) => (
              <CartItem key={item.product.id} item={item} />
            ))}
          </div>

          <div className="lg:sticky lg:top-24 h-fit">
            <Card>
              <CardContent className="p-6">
                <h2 className="mb-4 font-semibold">{t("orderSummary")}</h2>
                <CartSummary />
                <div className="mt-6 space-y-2">
                  <Button variant="gold" block size="lg" asChild>
                    <Link href={ROUTES.checkout}>{t("proceedToCheckout")}</Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    size="lg"
                    asChild
                  >
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
