import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendProductNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  console.log("send-product route hit");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.log("send-product: Unauthorized - no user");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  console.log("send-product: user", user.id, "role", profile?.role);

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    console.log("send-product API called with:", body);
    const { productId, type } = body;

    if (!productId || !["price_drop", "new_product", "back_in_stock"].includes(type)) {
      console.log("Invalid request - productId:", productId, "type:", type);
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await sendProductNotification(productId, type);

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Send product notification error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
