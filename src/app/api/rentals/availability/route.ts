import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBookedRanges } from "@/lib/rental-availability";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Booked date ranges for a rental product, so the rental dialog can disable
 * unavailable dates. Public and read-only — exposes only date ranges and
 * capacity, never order or customer data. Checkout re-validates server-side.
 */
export async function GET(request: Request) {
  const productId = new URL(request.url).searchParams.get("productId");
  if (!productId || !UUID_RE.test(productId)) {
    return NextResponse.json({ error: "Invalid productId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("stock, is_rental")
    .eq("id", productId)
    .single();

  if (!product?.is_rental) {
    return NextResponse.json({ error: "Not a rental product" }, { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const ranges = await getBookedRanges(admin, productId, today);

  return NextResponse.json(
    {
      capacity: product.stock,
      bookedRanges: ranges.map((r) => ({
        start: r.rental_start,
        end: r.rental_end,
        quantity: r.quantity,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
