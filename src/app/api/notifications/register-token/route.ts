import { NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { token, platform } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    // Bind the token to the authenticated session user only. A client-supplied
    // userId is NOT trusted — otherwise anyone could register their token under
    // a victim's id and receive that victim's push notifications. No session
    // means an anonymous device (user_id null).
    // Always derive from the verified session (getAuthUser uses getClaims for perf).
    let resolvedUserId: string | null = null;
    try {
      const supabaseAuth = await createClient();
      const user = await getAuthUser(supabaseAuth);
      if (user) resolvedUserId = user.id;
    } catch {
      // No session available, continue without user
    }

    const supabase = createAdminClient();

    const { error } = await supabase.from("device_tokens").upsert(
      {
        token,
        user_id: resolvedUserId,
        platform: platform || "android",
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Token registration error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
