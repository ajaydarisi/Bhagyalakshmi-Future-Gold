import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { NotificationComposer } from "@/components/admin/notification-composer";

export const metadata: Metadata = { title: "Notifications" };
import { NotificationsTable } from "@/components/admin/notifications-table";

export default async function AdminNotificationsPage() {
  const supabase = createAdminClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl text-text-primary md:text-4xl">Notifications</h1>
      <NotificationComposer />
      <NotificationsTable notifications={notifications ?? []} />
    </div>
  );
}
