import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { CouponsManager } from "@/components/admin/coupons-manager";

export const metadata: Metadata = { title: "Coupons" };

export default async function AdminCouponsPage() {
  const supabase = createAdminClient();

  const { data: coupons } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-text-primary md:text-4xl">Coupons</h1>
      <CouponsManager coupons={coupons ?? []} />
    </div>
  );
}
