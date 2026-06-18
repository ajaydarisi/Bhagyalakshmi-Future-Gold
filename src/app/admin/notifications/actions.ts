"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/admin-guard";

export async function getNotificationHistory() {
  await assertAdmin();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return data || [];
}

export async function searchUsers(query: string) {
  await assertAdmin();
  const supabase = createAdminClient();
  // Strip PostgREST filter metacharacters so the search term cannot break out
  // of the ilike pattern and inject additional or-conditions.
  const safeQuery = query.replace(/[,()%"\\]/g, " ").trim();
  if (!safeQuery) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .or(`email.ilike.%${safeQuery}%,full_name.ilike.%${safeQuery}%`)
    .limit(10);
  return data || [];
}
