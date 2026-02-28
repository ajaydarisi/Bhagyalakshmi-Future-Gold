import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendProductNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { productId, type } = await request.json();

    if (!productId || !["price_drop", "new_product", "back_in_stock"].includes(type)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await sendProductNotification(productId, type);

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Send product notification error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
