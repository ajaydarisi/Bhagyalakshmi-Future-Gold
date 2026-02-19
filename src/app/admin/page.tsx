import { IndianRupee, ShoppingBag, Package, Users } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice, formatDate } from "@/lib/formatters";
import { StatsCard } from "@/components/admin/stats-card";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RevenueChart } from "@/components/admin/revenue-chart";

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();

  // Fetch stats in parallel
  const [revenueResult, ordersResult, productsResult, usersResult] =
    await Promise.all([
      supabase
        .from("orders")
        .select("total")
        .in("status", ["paid", "processing", "shipped", "delivered"]),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true }),
    ]);

  const totalRevenue =
    revenueResult.data?.reduce((sum, o) => sum + o.total, 0) ?? 0;
  const totalOrders = ordersResult.count ?? 0;
  const totalProducts = productsResult.count ?? 0;
  const totalUsers = usersResult.count ?? 0;

  // Recent orders
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, order_number, user_id, status, total, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  // Get user emails for recent orders
  const userIds = [
    ...new Set(
      (recentOrders ?? []).map((o) => o.user_id).filter(Boolean) as string[]
    ),
  ];
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds)
    : { data: [] };

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.email])
  );

  // Revenue last 30 days - aggregate by day
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: revenueData } = await supabase
    .from("orders")
    .select("total, created_at")
    .in("status", ["paid", "processing", "shipped", "delivered"])
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  // Group by date
  const revenueByDay = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - 29 + i);
    const key = d.toISOString().split("T")[0];
    revenueByDay.set(key, 0);
  }

  (revenueData ?? []).forEach((order) => {
    const key = order.created_at.split("T")[0];
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + order.total);
  });

  const chartData = Array.from(revenueByDay.entries()).map(
    ([date, revenue]) => ({
      date,
      revenue,
    })
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Total Revenue"
          value={formatPrice(totalRevenue)}
          icon={IndianRupee}
        />
        <StatsCard
          label="Total Orders"
          value={totalOrders.toLocaleString()}
          icon={ShoppingBag}
        />
        <StatsCard
          label="Total Products"
          value={totalProducts.toLocaleString()}
          icon={Package}
        />
        <StatsCard
          label="Total Users"
          value={totalUsers.toLocaleString()}
          icon={Users}
        />
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueChart data={chartData} />
        </CardContent>
      </Card>

      {/* Recent orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders && recentOrders.length > 0 ? (
                recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.order_number}
                    </TableCell>
                    <TableCell>
                      {order.user_id
                        ? profileMap.get(order.user_id) ?? "Unknown"
                        : "Guest"}
                    </TableCell>
                    <TableCell>{formatDate(order.created_at)}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(order.total)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No orders yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
