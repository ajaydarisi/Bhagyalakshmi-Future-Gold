import { createAdminClient } from "@/lib/supabase/admin";
import { getFirebaseMessaging } from "@/lib/firebase-admin";

const ORDER_STATUS_MESSAGES: Record<
  string,
  { title: string; body: (orderNumber: string) => string }
> = {
  paid: {
    title: "Payment Confirmed",
    body: (n) => `Your payment for order ${n} has been confirmed.`,
  },
  processing: {
    title: "Order Being Processed",
    body: (n) => `Your order ${n} is being prepared.`,
  },
  shipped: {
    title: "Order Shipped!",
    body: (n) => `Your order ${n} has been shipped and is on the way!`,
  },
  delivered: {
    title: "Order Delivered",
    body: (n) => `Your order ${n} has been delivered. Enjoy!`,
  },
  cancelled: {
    title: "Order Cancelled",
    body: (n) => `Your order ${n} has been cancelled.`,
  },
  refunded: {
    title: "Refund Processed",
    body: (n) => `A refund for order ${n} has been processed.`,
  },
};

export async function sendOrderStatusNotification(
  orderId: string,
  newStatus: string
) {
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("order_number, user_id")
    .eq("id", orderId)
    .single();

  if (!order?.user_id) return;

  const template = ORDER_STATUS_MESSAGES[newStatus];
  if (!template) return;

  const { data: tokens } = await supabase
    .from("device_tokens")
    .select("token")
    .eq("user_id", order.user_id)
    .eq("is_active", true);

  if (!tokens?.length) return;

  const messaging = getFirebaseMessaging();
  const title = template.title;
  const body = template.body(order.order_number);

  try {
    const response = await messaging.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: { title, body },
      data: {
        type: "order_update",
        orderId,
        url: `/account/orders/${orderId}`,
      },
      android: {
        priority: "high",
        notification: { channelId: "orders", sound: "default", color: "#7a462e" },
      },
    });

    // Deactivate stale tokens
    response.responses.forEach((resp, idx) => {
      if (
        resp.error?.code === "messaging/registration-token-not-registered"
      ) {
        supabase
          .from("device_tokens")
          .update({ is_active: false })
          .eq("token", tokens[idx].token)
          .then(() => {});
      }
    });

    // Log to notifications table
    await supabase.from("notifications").insert({
      title,
      body,
      type: "order_update",
      target_type: "user",
      target_value: order.user_id,
      status: "sent",
      sent_count: response.successCount,
      failed_count: response.failureCount,
      sent_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Failed to send order notification:", e);
  }
}

const PRODUCT_NOTIFICATION_TEMPLATES: Record<
  string,
  { title: string; body: (name: string, price: string, isRentalOnly: boolean) => string }
> = {
  price_drop: {
    title: "Price Drop!",
    body: (name, price, isRentalOnly) =>
      isRentalOnly
        ? `${name} is now available for rent at ₹${price}!`
        : `${name} is now available at ₹${price}!`,
  },
  new_product: {
    title: "New Arrival!",
    body: (name) => `Check out ${name} - just added to our collection!`,
  },
  back_in_stock: {
    title: "Back in Stock!",
    body: (name) => `${name} is available again. Get it before it's gone!`,
  },
};

export async function sendProductNotification(
  productId: string,
  type: "price_drop" | "new_product" | "back_in_stock"
) {
  const supabase = createAdminClient();

  const { data: product } = await supabase
    .from("products")
    .select("name, slug, price, discount_price, is_sale, is_rental, rental_price, rental_discount_price, images")
    .eq("id", productId)
    .single();

  if (!product) throw new Error("Product not found");

  const template = PRODUCT_NOTIFICATION_TEMPLATES[type];
  if (!template) throw new Error("Invalid notification type");

  const isRentalOnly = product.is_rental && !product.is_sale;
  const price = isRentalOnly
    ? (product.rental_discount_price ?? product.rental_price ?? product.price)
    : (product.discount_price ?? product.price);
  const title = template.title;
  const body = template.body(product.name, String(price), isRentalOnly);
  const imageUrl = product.images?.[0] || undefined;

  const messaging = getFirebaseMessaging();
  const notificationPayload = {
    notification: { title, body, imageUrl },
    data: {
      type,
      productId,
      url: `/products/${product.slug}`,
    },
    android: {
      priority: "high" as const,
      notification: { channelId: "default", sound: "default", color: "#7a462e" },
    },
  };

  try {
    let sentCount = 0;
    let failedCount = 0;
    let targetType = "all";

    if (type === "price_drop") {
      // Send only to users who wishlisted this product
      const { data: wishlistUsers } = await supabase
        .from("wishlist_items")
        .select("user_id")
        .eq("product_id", productId);

      if (!wishlistUsers?.length) return { success: true };

      const userIds = [...new Set(wishlistUsers.map((w) => w.user_id))];

      const { data: tokens } = await supabase
        .from("device_tokens")
        .select("token")
        .in("user_id", userIds)
        .eq("is_active", true);

      if (!tokens?.length) return { success: true };

      const response = await messaging.sendEachForMulticast({
        tokens: tokens.map((t) => t.token),
        ...notificationPayload,
      });

      sentCount = response.successCount;
      failedCount = response.failureCount;
      targetType = "wishlist";

      // Deactivate stale tokens
      response.responses.forEach((resp, idx) => {
        if (resp.error?.code === "messaging/registration-token-not-registered") {
          supabase
            .from("device_tokens")
            .update({ is_active: false })
            .eq("token", tokens[idx].token)
            .then(() => {});
        }
      });
    } else {
      // Broadcast to all users for new_product, back_in_stock
      await messaging.send({
        topic: "all_users",
        ...notificationPayload,
      });
      sentCount = 1;
    }

    await supabase.from("notifications").insert({
      title,
      body,
      image_url: imageUrl || null,
      type,
      target_type: targetType,
      status: "sent",
      sent_count: sentCount,
      failed_count: failedCount,
      sent_at: new Date().toISOString(),
    });

    return { success: true };
  } catch (e) {
    console.error("Failed to send product notification:", e);
    throw e;
  }
}
