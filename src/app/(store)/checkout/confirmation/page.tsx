import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatPrice, formatDate } from "@/lib/formatters";
import { ROUTES } from "@/lib/constants";
import { CheckCircle, Package, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Order Confirmed",
};

interface ConfirmationPageProps {
  searchParams: Promise<{ order_id?: string }>;
}

export default async function ConfirmationPage({
  searchParams,
}: ConfirmationPageProps) {
  const params = await searchParams;
  const orderId = params.order_id;

  if (!orderId) redirect(ROUTES.home);

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*, order_items:order_items(*)")
    .eq("id", orderId)
    .single();

  if (!order) redirect(ROUTES.home);

  const address = order.shipping_address as {
    full_name: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold">Order Confirmed!</h1>
        <p className="mt-2 text-muted-foreground">
          Thank you for your purchase. Your order has been placed successfully.
        </p>

        <Card className="mt-8 text-left">
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Order Number</p>
                <p className="font-mono font-bold">{order.order_number}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Date</p>
                <p>{formatDate(order.created_at)}</p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Items
              </p>
              <div className="mt-2 space-y-2">
                {(order.order_items as Array<{
                  id: string;
                  product_name: string;
                  quantity: number;
                  unit_price: number;
                  total_price: number;
                }>).map(
                  (item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>
                        {item.product_name} x {item.quantity}
                      </span>
                      <span>{formatPrice(item.total_price)}</span>
                    </div>
                  )
                )}
              </div>
            </div>

            <Separator />

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

            <Separator />

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Shipping Address
              </p>
              <p className="mt-1 text-sm">
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
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 flex justify-center gap-4">
          <Button asChild>
            <Link href={ROUTES.accountOrders}>
              <Package className="mr-2 h-4 w-4" />
              View Orders
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={ROUTES.products}>
              Continue Shopping
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
