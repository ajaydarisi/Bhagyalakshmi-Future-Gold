import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRentalOverdue } from "@/lib/rental-availability";
import { OrdersTable } from "@/components/admin/orders-table";

export const metadata: Metadata = { title: "Orders" };

export default async function AdminOrdersPage() {
  const supabase = createAdminClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(is_rental, rental_end)")
    .order("created_at", { ascending: false })
    .range(0, 99);

  // Gather user emails
  const userIds = [
    ...new Set(
      (orders ?? []).map((o) => o.user_id).filter(Boolean) as string[]
    ),
  ];

  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, email").in("id", userIds)
    : { data: [] };

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.email])
  );

  const ordersWithEmail = (orders ?? []).map((o) => {
    const items = (o.order_items ?? []) as { is_rental: boolean; rental_end: string | null }[];
    const latestRentalEnd = items
      .filter((i) => i.is_rental && i.rental_end)
      .map((i) => i.rental_end as string)
      .sort()
      .pop();
    return {
      ...o,
      customer_email: o.user_id ? profileMap[o.user_id] ?? "Unknown" : "Guest",
      rental_overdue: isRentalOverdue(o.rental_status, latestRentalEnd),
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-text-primary md:text-4xl">Orders</h1>
      <OrdersTable orders={ordersWithEmail} />
    </div>
  );
}
