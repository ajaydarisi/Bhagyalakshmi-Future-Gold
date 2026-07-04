import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice, formatDate, formatDateTime } from "@/lib/formatters";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { OrderStatusUpdater } from "@/components/admin/order-status-updater";
import { RentalStatusBadge } from "@/components/admin/rental-status-badge";
import { RentalReturnButton } from "@/components/admin/rental-return-button";
import { isRentalOverdue } from "@/lib/rental-availability";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface OrderItem {
  id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_rental: boolean;
  rental_start: string | null;
  rental_end: string | null;
}

interface ShippingAddress {
  full_name?: string;
  phone?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: OrderDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("order_number")
    .eq("id", id)
    .single();
  return { title: order ? `Order ${order.order_number}` : "Order" };
}

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, order_items(*), payment_transactions(*)")
    .eq("id", id)
    .single();

  if (!order) {
    notFound();
  }

  // Get customer info
  let customerEmail = "Guest";
  if (order.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", order.user_id)
      .single();
    if (profile) {
      customerEmail = profile.email;
    }
  }

  const shipping = order.shipping_address as unknown as ShippingAddress;
  const payment = order.payment_transactions?.[0];

  const isRentalOrder = order.order_type !== "sale";
  const latestRentalEnd = (order.order_items as OrderItem[])
    .filter((i) => i.is_rental && i.rental_end)
    .map((i) => i.rental_end as string)
    .sort()
    .pop();
  const rentalOverdue = isRentalOverdue(order.rental_status, latestRentalEnd);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-text-primary md:text-4xl">
            Order {order.order_number}
          </h1>
          <p className="text-muted-foreground">
            Placed on {formatDateTime(order.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {isRentalOrder && (
            <RentalStatusBadge
              rentalStatus={order.rental_status}
              isOverdue={rentalOverdue}
            />
          )}
          {isRentalOrder && order.rental_status === "active" && (
            <RentalReturnButton orderId={order.id} />
          )}
          <OrderStatusBadge status={order.status} />
          <OrderStatusUpdater orderId={order.id} currentStatus={order.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order items */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.order_items.map((item: OrderItem) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {item.product_image && (
                            <div className="relative size-10 overflow-hidden rounded-md">
                              <Image
                                src={item.product_image}
                                alt={item.product_name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          )}
                          <div>
                            <span className="font-medium">
                              {item.product_name}
                            </span>
                            {item.is_rental && item.rental_start && item.rental_end && (
                              <p className="text-xs text-muted-foreground">
                                Rental: {formatDate(item.rental_start)} –{" "}
                                {formatDate(item.rental_end)} · Return by{" "}
                                {formatDate(item.rental_end)}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="hidden text-right sm:table-cell">
                        {formatPrice(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPrice(item.total_price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{formatPrice(order.shipping_cost)}</span>
                </div>
                {order.discount_amount > 0 && (
                  <div className="flex justify-between text-[var(--bfg-success)]">
                    <span>Discount</span>
                    <span>-{formatPrice(order.discount_amount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="font-medium">{customerEmail}</p>
              {order.user_id && (
                <p className="text-muted-foreground">ID: {order.user_id}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed">
              {shipping ? (
                <>
                  <p className="font-medium">{shipping.full_name}</p>
                  {shipping.phone && <p>{shipping.phone}</p>}
                  <p>{shipping.address_line_1}</p>
                  {shipping.address_line_2 && <p>{shipping.address_line_2}</p>}
                  <p>
                    {shipping.city}, {shipping.state} {shipping.postal_code}
                  </p>
                  <p>{shipping.country}</p>
                </>
              ) : (
                <p className="text-muted-foreground">No address provided</p>
              )}
            </CardContent>
          </Card>

          {payment && (
            <Card>
              <CardHeader>
                <CardTitle>Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="capitalize">{payment.status}</span>
                </div>
                {payment.method && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <span className="capitalize">{payment.method}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span>{formatPrice(payment.amount)}</span>
                </div>
                {payment.razorpay_payment_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment ID</span>
                    <span className="truncate max-w-[140px] text-xs">
                      {payment.razorpay_payment_id}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {order.notes}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
