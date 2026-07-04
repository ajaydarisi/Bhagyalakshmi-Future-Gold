import { Link } from "@/i18n/routing";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatPrice, formatDate } from "@/lib/formatters";
import { ROUTES } from "@/lib/constants";
import { CheckCircle, Package, ArrowRight } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cart.confirmation");
  return { title: t("metaTitle") };
}

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

  const t = await getTranslations("cart.confirmation");

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
      <div className="mx-auto max-w-2xl text-center bfg-animate">
        <div className="mb-6 flex justify-center">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full text-[var(--ivory-50)]"
            style={{ background: "var(--grad-gold)", boxShadow: "var(--shadow-gold)" }}
          >
            <CheckCircle className="h-11 w-11" strokeWidth={1.7} />
          </div>
        </div>
        <span className="bfg-ornament justify-center">
          <span className="bfg-eyebrow">{t("metaTitle")}</span>
        </span>
        <h1 className="mt-3 font-display text-4xl text-text-primary">{t("title")}</h1>
        <p className="mt-2 text-text-secondary">
          {t("description")}
        </p>

        <Card className="mt-8 text-left border-[var(--border-gold)] shadow-[var(--shadow-md)]">
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("orderNumber")}</p>
                <p className="font-mono font-bold">{order.order_number}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t("date")}</p>
                <p>{formatDate(order.created_at)}</p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("items")}
              </p>
              <div className="mt-2 space-y-2">
                {(order.order_items as Array<{
                  id: string;
                  product_name: string;
                  quantity: number;
                  unit_price: number;
                  total_price: number;
                  is_rental: boolean;
                  rental_start: string | null;
                  rental_end: string | null;
                }>).map(
                  (item) => (
                    <div key={item.id} className="text-sm">
                      <div className="flex justify-between">
                        <span>
                          {item.product_name} x {item.quantity}
                        </span>
                        <span>{formatPrice(item.total_price)}</span>
                      </div>
                      {item.is_rental && item.rental_start && item.rental_end && (
                        <p className="text-xs text-text-gold">
                          {t("rentalPeriod", {
                            start: formatDate(item.rental_start),
                            end: formatDate(item.rental_end),
                          })}{" "}
                          · {t("returnBy", { date: formatDate(item.rental_end) })}
                        </p>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("subtotal")}</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-[var(--bfg-success)]">
                  <span>{t("discount")}</span>
                  <span>-{formatPrice(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("shipping")}</span>
                <span>
                  {order.shipping_cost === 0
                    ? t("free")
                    : formatPrice(order.shipping_cost)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>{t("total")}</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("shippingAddress")}
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

        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
          <Button variant="gold" size="bfg-md" asChild>
            <Link href={ROUTES.accountOrders}>
              <Package className="mr-2 h-4 w-4" />
              {t("viewOrders")}
            </Link>
          </Button>
          <Button variant="gold-outline" size="bfg-md" asChild>
            <Link href={ROUTES.products}>
              {t("continueShopping")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
