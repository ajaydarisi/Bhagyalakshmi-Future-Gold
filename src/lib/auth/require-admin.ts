import { createClient } from "@/lib/supabase/server";

/**
 * Verifies the current request is made by an authenticated admin user.
 *
 * Server Actions and route handlers must never rely on middleware path
 * matching alone for authorization — this is the in-handler defense-in-depth
 * check. Throws on failure so callers (server actions) surface a structured
 * error; route handlers should catch and map to a 401/403 response.
 */
export async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Forbidden");
  }

  return user;
}
