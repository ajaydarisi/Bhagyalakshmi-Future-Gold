import { createAdminClient } from "@/lib/supabase/admin";
import { getFirebaseMessaging } from "@/lib/firebase-admin";
import { formatDate } from "@/lib/formatters";

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
  let body = template.body(order.order_number);

  // Rental orders: remind the customer to return rented items when delivered.
  if (newStatus === "delivered") {
    const { data: rentalItems } = await supabase
      .from("order_items")
      .select("rental_end")
      .eq("order_id", orderId)
      .eq("is_rental", true);

    const dueDates = (rentalItems ?? [])
      .map((i) => i.rental_end)
      .filter((d): d is string => Boolean(d))
      .sort();
    if (dueDates.length > 0) {
      body += ` Please return the rented items by ${formatDate(dueDates[0])}.`;
    }
  }

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
  const channelId = type === "price_drop" || type === "back_in_stock"
    ? "wishlist"
    : type === "new_product"
      ? "new_products"
      : "default";
  const notificationPayload = {
    notification: { title, body, imageUrl },
    data: {
      type,
      productId,
      url: `/products/${product.slug}`,
    },
    android: {
      priority: "high" as const,
      notification: { channelId, sound: "default", color: "#7a462e" },
    },
  };

  // Push to a specific set of users (their active device tokens), deactivating
  // any tokens Firebase reports as stale. Shared by the wishlist (price_drop)
  // and stock-alert (back_in_stock) paths.
  async function deliverToUsers(userIds: string[]) {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) return { sentCount: 0, failedCount: 0 };

    const { data: tokens } = await supabase
      .from("device_tokens")
      .select("token")
      .in("user_id", uniqueIds)
      .eq("is_active", true);

    if (!tokens?.length) return { sentCount: 0, failedCount: 0 };

    const response = await messaging.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      ...notificationPayload,
    });

    response.responses.forEach((resp, idx) => {
      if (resp.error?.code === "messaging/registration-token-not-registered") {
        supabase
          .from("device_tokens")
          .update({ is_active: false })
          .eq("token", tokens[idx].token)
          .then(() => {});
      }
    });

    return { sentCount: response.successCount, failedCount: response.failureCount };
  }

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

      targetType = "wishlist";
      ({ sentCount, failedCount } = await deliverToUsers(
        wishlistUsers.map((w) => w.user_id)
      ));
    } else if (type === "back_in_stock") {
      // Only users who subscribed to this product via the notify-stock button.
      const { data: alertUsers } = await supabase
        .from("stock_alerts")
        .select("user_id")
        .eq("product_id", productId);

      if (!alertUsers?.length) return { success: true };

      targetType = "stock_alert";
      ({ sentCount, failedCount } = await deliverToUsers(
        alertUsers.map((a) => a.user_id)
      ));

      // The "back in stock" event is now spent — clear the subscriptions so a
      // future restock doesn't re-notify people who already got this one.
      await supabase.from("stock_alerts").delete().eq("product_id", productId);
    } else {
      // Broadcast to all users for new_product
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
