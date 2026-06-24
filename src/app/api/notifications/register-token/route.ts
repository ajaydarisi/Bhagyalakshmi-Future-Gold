import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { token, platform } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    // Always derive the user from the verified session — never trust a
    // client-supplied userId, which would let a caller bind a device token
    // to another user's account. Anonymous (pre-login) tokens are allowed
    // and stored with a null user_id.
    let resolvedUserId: string | null = null;
    try {
      const supabaseAuth = await createClient();
      const {
        data: { user },
      } = await supabaseAuth.auth.getUser();
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
