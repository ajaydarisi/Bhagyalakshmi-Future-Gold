import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatPrice, formatDate } from "@/lib/formatters";
import { ROUTES } from "@/lib/constants";
import { Package, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.orders");
  return { title: t("metaTitle") };
}

export default async function OrdersPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  if (!user) redirect("/login?redirect=/account/orders");

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const t = await getTranslations("account.orders");

  if (!orders || orders.length === 0) {
    return (
      <EmptyState
        icon={<Package className="h-8 w-8" strokeWidth={1.7} />}
        title={t("noOrders")}
        description={t("noOrdersDesc")}
        actionLabel={t("startShopping")}
        actionHref={ROUTES.products}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl text-text-primary">{t("orderHistory")}</h2>
      {orders.map((order) => (
        <Card key={order.id} className="transition-colors hover:border-[var(--border-gold)]">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <p className="font-mono text-sm font-bold tabular-nums text-text-gold">
                    {order.order_number}
                  </p>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="text-sm text-text-secondary">
                  {formatDate(order.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="font-display text-xl text-text-primary">{formatPrice(order.total)}</p>
                <Button variant="gold-outline" size="bfg-sm" asChild>
                  <Link href={ROUTES.accountOrder(order.id)}>
                    {t("view")}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
