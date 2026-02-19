import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { formatPrice, formatDate } from "@/lib/formatters";
import { ORDER_STATUSES, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export const metadata: Metadata = {
  title: "Order Details",
};

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

const STATUS_FLOW = ["pending", "paid", "processing", "shipped", "delivered"];

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: order } = await supabase
    .from("orders")
    .select("*, order_items:order_items(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!order) notFound();

  const address = order.shipping_address as {
    full_name: string;
    phone: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
  };

  const currentStatusIndex = STATUS_FLOW.indexOf(order.status);
  const isCancelled = order.status === "cancelled" || order.status === "refunded";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            Order {order.order_number}
          </h2>
          <p className="text-sm text-muted-foreground">
            Placed on {formatDate(order.created_at)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Status Timeline */}
      {!isCancelled && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              {STATUS_FLOW.map((status, index) => {
                const isCompleted = index <= currentStatusIndex;
                const isCurrent = index === currentStatusIndex;
                const statusInfo = ORDER_STATUSES.find(
                  (s) => s.value === status
                );
                return (
                  <div
                    key={status}
                    className="flex flex-1 flex-col items-center"
                  >
                    <div className="flex w-full items-center">
                      {index > 0 && (
                        <div
                          className={cn(
                            "h-0.5 flex-1",
                            isCompleted ? "bg-primary" : "bg-muted"
                          )}
                        />
                      )}
                      <div
                        className={cn(
                          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2",
                          isCompleted
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted bg-background"
                        )}
                      >
                        {isCompleted ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <span className="text-xs">{index + 1}</span>
                        )}
                      </div>
                      {index < STATUS_FLOW.length - 1 && (
                        <div
                          className={cn(
                            "h-0.5 flex-1",
                            index < currentStatusIndex
                              ? "bg-primary"
                              : "bg-muted"
                          )}
                        />
                      )}
                    </div>
                    <span
                      className={cn(
                        "mt-2 text-xs",
                        isCurrent
                          ? "font-medium text-primary"
                          : "text-muted-foreground"
                      )}
                    >
                      {statusInfo?.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {(order.order_items as Array<{
              id: string;
              product_id: string | null;
              product_name: string;
              product_image: string | null;
              quantity: number;
              unit_price: number;
              total_price: number;
            }>).map(
              (item) => (
                <div key={item.id} className="flex gap-4 py-3">
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.product_image && (
                      <Image
                        src={item.product_image}
                        alt={item.product_name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Qty: {item.quantity} x {formatPrice(item.unit_price)}
                    </p>
                  </div>
                  <p className="font-medium">
                    {formatPrice(item.total_price)}
                  </p>
                </div>
              )
            )}
          </div>

          <Separator className="my-4" />

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-{formatPrice(order.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>
                {order.shipping_cost === 0
                  ? "Free"
                  : formatPrice(order.shipping_cost)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Address */}
      <Card>
        <CardHeader>
          <CardTitle>Shipping Address</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            {address.full_name}
            <br />
            {address.address_line_1}
            {address.address_line_2 && (
              <>
                <br />
                {address.address_line_2}
              </>
            )}
            <br />
            {address.city}, {address.state} {address.postal_code}
            <br />
            Phone: {address.phone}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
