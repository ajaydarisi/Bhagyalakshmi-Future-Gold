import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay/verify";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderStatusNotification } from "@/lib/notifications";

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

      // Update order status. The pending guard doubles as a fulfillment lock:
      // if verifyPayment already processed this order, no row transitions and
      // we skip decrement/cart-clear so nothing runs twice.
      const { data: transitioned } = await admin
        .from("orders")
        .update({ status: "paid" })
        .eq("id", transaction.order_id)
        .eq("status", "pending")
        .select("user_id, order_type, coupon_id");

      if (transitioned && transitioned.length > 0) {
        const order = transitioned[0];

        await admin
          .from("order_status_history")
          .insert({ order_id: transaction.order_id, status: "paid" });

        // Count coupon usage now that payment succeeded (atomic, enforces max_uses)
        if (order.coupon_id) {
          await admin.rpc("increment_coupon_usage" as never, {
            coupon_id: order.coupon_id,
          } as never);
        }

        const { data: orderItems } = await admin
          .from("order_items")
          .select("product_id, quantity, is_rental")
          .eq("order_id", transaction.order_id);

        // Rental lines never decrement stock — for rentals, stock is the
        // rental capacity and availability is computed per booked period.
        if (orderItems && orderItems.length > 0) {
          const items = orderItems
            .filter((i) => i.product_id && !i.is_rental)
            .map((i) => ({ product_id: i.product_id, quantity: i.quantity }));
          if (items.length > 0) {
            await admin.rpc("decrement_product_stock" as never, { items } as never);
          }
        }

        // Rental lifecycle: paid rental orders start as "booked"
        if (order.order_type !== "sale") {
          await admin
            .from("orders")
            .update({ rental_status: "booked" })
            .eq("id", transaction.order_id);
        }

        // Clear user's cart
        if (order.user_id) {
          await admin
            .from("cart_items")
            .delete()
            .eq("user_id", order.user_id);
        }

        // Send push notification for payment confirmation
        sendOrderStatusNotification(transaction.order_id, "paid").catch(
          console.error
        );
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
