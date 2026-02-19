import { createAdminClient } from "@/lib/supabase/admin";
import { CouponsManager } from "@/components/admin/coupons-manager";

export default async function AdminCouponsPage() {
  const supabase = createAdminClient();

  const { data: coupons } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Coupons</h1>
      <CouponsManager coupons={coupons ?? []} />
    </div>
  );
}
