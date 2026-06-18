import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Authorization guard for admin-only server actions.
 *
 * Next.js server actions are dispatched by hash and are reachable by POSTing to
 * ANY route, so the `/admin` middleware gate does not protect them. Every admin
 * server action must call this first to verify the caller is an authenticated
 * admin — middleware/route protection alone is not sufficient.
 *
 * Returns the admin user's id; throws "Unauthorized" otherwise.
 */
export async function assertAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Unauthorized");

  return user.id;
}
