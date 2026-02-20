"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CheckoutSteps } from "@/components/checkout/checkout-steps";
import { CouponInput } from "@/components/checkout/coupon-input";
import { PaymentButton } from "@/components/checkout/payment-button";
import { AddressForm } from "@/components/checkout/address-form";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/formatters";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_COST, ROUTES } from "@/lib/constants";
import type { Address } from "@/types/user";
import type { AddressInput } from "@/lib/validators";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, ArrowLeft, ArrowRight } from "lucide-react";

export default function CheckoutPage() {
  const t = useTranslations("cart.checkout");
  const tc = useTranslations("cart");
  const [step, setStep] = useState(0);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [coupon, setCoupon] = useState<{
    code: string;
    discount: number;
  } | null>(null);
  const [addAddressOpen, setAddAddressOpen] = useState(false);

  const { items, subtotal, isLoading: cartLoading } = useCart();
  const { user, profile, isLoggedIn, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.push("/login?redirect=/checkout");
    }
  }, [authLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!cartLoading && items.length === 0 && !authLoading) {
      router.push(ROUTES.cart);
    }
  }, [cartLoading, items.length, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
  }, [user]);

  async function fetchAddresses() {
    if (!user) return;
    const { data } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });
    setAddresses(data || []);
    if (data && data.length > 0 && !selectedAddressId) {
      setSelectedAddressId(data[0].id);
    }
  }

  async function handleAddAddress(data: AddressInput) {
    if (!user) return;
    const { error } = await supabase
      .from("addresses")
      .insert({ ...data, user_id: user.id });
    if (error) {
      toast.error(t("addressAddError"));
    } else {
      toast.success(t("addressAddSuccess"));
      setAddAddressOpen(false);
      fetchAddresses();
    }
  }

  const shipping =
    subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const discount = coupon?.discount || 0;
  const total = subtotal - discount + shipping;

  if (authLoading || cartLoading) {
    return (
      <div className="container mx-auto flex items-center justify-center px-4 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <CheckoutSteps currentStep={step} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          {/* Step 0: Address */}
          {step === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {t("selectAddress")}
                  <Dialog open={addAddressOpen} onOpenChange={setAddAddressOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        {t("addNew")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{t("addNewAddress")}</DialogTitle>
                      </DialogHeader>
                      <AddressForm
                        onSubmit={handleAddAddress}
                        onCancel={() => setAddAddressOpen(false)}
                      />
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {addresses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("noAddresses")}
                  </p>
                ) : (
                  <RadioGroup
                    value={selectedAddressId}
                    onValueChange={setSelectedAddressId}
                    className="space-y-3"
                  >
                    {addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="flex items-start gap-3 rounded-md border p-4"
                      >
                        <RadioGroupItem value={addr.id} id={addr.id} />
                        <Label htmlFor={addr.id} className="flex-1 cursor-pointer">
                          <p className="font-medium">
                            {addr.label} - {addr.full_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {addr.address_line_1}
                            {addr.address_line_2 && `, ${addr.address_line_2}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {addr.city}, {addr.state} {addr.postal_code}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t("phone", { phone: addr.phone })}
                          </p>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={() => setStep(1)}
                    disabled={!selectedAddressId}
                  >
                    {t("continue")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 1: Review */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("orderReview")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="divide-y">
                  {items.map((item) => {
                    const price =
                      item.product.discount_price || item.product.price;
                    return (
                      <div
                        key={item.product.id}
                        className="flex gap-4 py-3"
                      >
                        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                          {item.product.images[0] && (
                            <Image
                              src={item.product.images[0]}
                              alt={item.product.name}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{item.product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {t("qty", { quantity: item.quantity, price: formatPrice(price) })}
                          </p>
                        </div>
                        <p className="font-medium">
                          {formatPrice(price * item.quantity)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <Separator />

                <CouponInput
                  subtotal={subtotal}
                  onApply={(code, discount) => setCoupon({ code, discount })}
                  onRemove={() => setCoupon(null)}
                  appliedCoupon={coupon}
                />

                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setStep(0)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t("back")}
                  </Button>
                  <Button onClick={() => setStep(2)}>
                    {t("proceedToPayment")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Payment */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("payment")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("paymentDescription")}
                </p>
                <PaymentButton
                  addressId={selectedAddressId}
                  couponCode={coupon?.code || null}
                  userEmail={user?.email || ""}
                  userName={profile?.full_name || ""}
                  onSuccess={(orderId) => {
                    router.push(
                      `${ROUTES.checkoutConfirmation}?order_id=${orderId}`
                    );
                  }}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("backToReview")}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Order Summary Sidebar */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{tc("orderSummary")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t("subtotal", { count: items.length })}
              </span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>{t("couponDiscount")}</span>
                <span>-{formatPrice(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("shipping")}</span>
              <span>{shipping === 0 ? t("free") : formatPrice(shipping)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>{t("total")}</span>
              <span>{formatPrice(total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
