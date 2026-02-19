import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatPrice, formatDate } from "@/lib/formatters";
import { ROUTES } from "@/lib/constants";
import { Package, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "My Orders",
};

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/account/orders");

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!orders || orders.length === 0) {
    return (
      <EmptyState
        icon={<Package className="h-16 w-16" />}
        title="No orders yet"
        description="Your order history will appear here once you make a purchase."
        actionLabel="Start Shopping"
        actionHref={ROUTES.products}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Order History</h2>
      {orders.map((order) => (
        <Card key={order.id}>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <p className="font-mono text-sm font-bold">
                    {order.order_number}
                  </p>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(order.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-lg font-bold">{formatPrice(order.total)}</p>
                <Button variant="outline" size="sm" asChild>
                  <Link href={ROUTES.accountOrder(order.id)}>
                    View
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
