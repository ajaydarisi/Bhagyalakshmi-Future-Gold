import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay/verify";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!signature || !verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);
    const admin = createAdminClient();

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const razorpayOrderId = payment.order_id;

      // Find the payment transaction
      const { data: transaction } = await admin
        .from("payment_transactions")
        .select("order_id")
        .eq("razorpay_order_id", razorpayOrderId)
        .single();

      if (!transaction) {
        return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
      }

      // Update payment transaction
      await admin
        .from("payment_transactions")
        .update({
          razorpay_payment_id: payment.id,
          status: "captured",
          method: payment.method,
        })
        .eq("razorpay_order_id", razorpayOrderId);

      // Update order status
      await admin
        .from("orders")
        .update({ status: "paid" })
        .eq("id", transaction.order_id)
        .eq("status", "pending"); // Only update if still pending (idempotent)

      // Decrement stock
      const { data: orderItems } = await admin
        .from("order_items")
        .select("product_id, quantity")
        .eq("order_id", transaction.order_id);

      if (orderItems) {
        for (const item of orderItems) {
          if (item.product_id) {
            const { data: product } = await admin
              .from("products")
              .select("stock")
              .eq("id", item.product_id)
              .single();

            if (product) {
              await admin
                .from("products")
                .update({
                  stock: Math.max(0, product.stock - item.quantity),
                })
                .eq("id", item.product_id);
            }
          }
        }
      }

      // Clear user's cart
      const { data: order } = await admin
        .from("orders")
        .select("user_id")
        .eq("id", transaction.order_id)
        .single();

      if (order?.user_id) {
        await admin
          .from("cart_items")
          .delete()
          .eq("user_id", order.user_id);
      }
    }

    if (event.event === "payment.failed") {
      const payment = event.payload.payment.entity;
      const razorpayOrderId = payment.order_id;

      await admin
        .from("payment_transactions")
        .update({
          status: "failed",
          error_description: payment.error_description,
        })
        .eq("razorpay_order_id", razorpayOrderId);
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
