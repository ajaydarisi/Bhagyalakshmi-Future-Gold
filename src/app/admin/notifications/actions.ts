"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function getNotificationHistory() {
  await requireAdmin();

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return data || [];
}

export async function searchUsers(query: string) {
  await requireAdmin();

  // Strip characters that have meaning in PostgREST filter syntax (comma
  // separates conditions, parentheses group them) to prevent filter injection
  // into the .or() expression below.
  const safeQuery = query.replace(/[,()\\%*]/g, " ").trim().slice(0, 100);
  if (!safeQuery) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .or(`email.ilike.%${safeQuery}%,full_name.ilike.%${safeQuery}%`)
    .limit(10);
  return data || [];
}
