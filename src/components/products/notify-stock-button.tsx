"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";

interface NotifyStockButtonProps {
  productId: string;
}

export function NotifyStockButton({ productId }: NotifyStockButtonProps) {
  const { user, isLoggedIn, isLoading } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations("products.detail");

  useEffect(() => {
    // Only a logged-in user has an alert to look up. The guest case is handled
    // by the render gate below, so no state is set synchronously in the effect.
    if (!user) return;

    let active = true;
    (async () => {
      const { data } = await supabase
        .from("stock_alerts")
        .select("id")
        .eq("product_id", productId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      setSubscribed(!!data);
      setChecking(false);
    })();

    return () => {
      active = false;
    };
  }, [user, productId, supabase]);

  async function handleToggle() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=${window.location.pathname}`);
      return;
    }

    setLoading(true);

    if (subscribed) {
      const { error } = await supabase
        .from("stock_alerts")
        .delete()
        .eq("product_id", productId)
        .eq("user_id", user!.id);

      if (error) {
        toast.error(t("notifyError"));
      } else {
        setSubscribed(false);
        toast.success(t("notifyRemoved"));
      }
    } else {
      const { error } = await supabase
        .from("stock_alerts")
        .insert({ product_id: productId, user_id: user!.id });

      if (error) {
        toast.error(t("notifyError"));
      } else {
        setSubscribed(true);
        toast.success(t("notifySuccess"));
      }
    }

    setLoading(false);
  }

  // Block render only while an actively-checking logged-in user's lookup is in flight.
  // Guests (no user) fall straight through to the button (which routes them to login).
  if (isLoading || (user && checking)) return null;

  return (
    <Button
      variant={subscribed ? "outline" : "default"}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className="mt-2"
    >
      {subscribed ? (
        <>
          <BellOff className="mr-2 h-4 w-4" />
          {t("notifySubscribed")}
        </>
      ) : (
        <>
          <Bell className="mr-2 h-4 w-4" />
          {t("notifyMe")}
        </>
      )}
    </Button>
  );
}
