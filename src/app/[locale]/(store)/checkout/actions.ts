"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRazorpayClient } from "@/lib/razorpay/client";
import { verifyRazorpaySignature } from "@/lib/razorpay/verify";
import { generateOrderNumber } from "@/lib/formatters";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_COST, STORE_MODE } from "@/lib/constants";

export async function createOrder(
  addressId: string,
  couponCode?: string | null
) {
  if (STORE_MODE === "OFFLINE") throw new Error("Store is currently offline");
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get cart items and shipping address in parallel
  const [{ data: cartItems }, { data: address }] = await Promise.all([
    supabase
      .from("cart_items")
      .select("quantity, product:products(*)")
      .eq("user_id", user.id),
    supabase
      .from("addresses")
      .select("*")
      .eq("id", addressId)
      .eq("user_id", user.id)
      .single(),
  ]);

  if (!cartItems || cartItems.length === 0) {
    throw new Error("Cart is empty");
  }

  if (!address) throw new Error("Address not found");

  // Validate stock
  for (const item of cartItems) {
    const product = item.product as unknown as { stock: number; name: string };
    if (product.stock < item.quantity) {
      throw new Error(`${product.name} is out of stock`);
    }
  }

  // Calculate subtotal
  const subtotal = cartItems.reduce((sum, item) => {
    const product = item.product as unknown as {
      price: number;
      discount_price: number | null;
    };
    const price = product.discount_price || product.price;
    return sum + price * item.quantity;
  }, 0);

  // Apply coupon
  let discountAmount = 0;
  let couponId: string | null = null;

  if (couponCode) {
    const { data: coupon } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", couponCode.toUpperCase())
      .eq("is_active", true)
      .single();

    if (coupon) {
      if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
        throw new Error(
          `Minimum order amount for this coupon is ₹${coupon.min_order_amount}`
        );
      }
      if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
        throw new Error("Coupon usage limit reached");
      }
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        throw new Error("Coupon has expired");
      }

      couponId = coupon.id;
      discountAmount =
        coupon.discount_type === "percentage"
          ? Math.round((subtotal * coupon.discount_value) / 100)
          : coupon.discount_value;
    }
  }

  const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const total = subtotal - discountAmount + shippingCost;

  // Create order
  const orderNumber = generateOrderNumber();
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: user.id,
      status: "pending",
      subtotal,
      shipping_cost: shippingCost,
      discount_amount: discountAmount,
      total,
      coupon_id: couponId,
      shipping_address: {
        full_name: address.full_name,
        phone: address.phone,
        address_line_1: address.address_line_1,
        address_line_2: address.address_line_2,
        city: address.city,
        state: address.state,
        postal_code: address.postal_code,
        country: address.country,
      },
    })
    .select()
    .single();

  if (orderError || !order) throw new Error("Failed to create order");

  // Record initial status in history
  await admin
    .from("order_status_history")
    .insert({ order_id: order.id, status: "pending" });

  // Create order items
  const orderItems = cartItems.map((item) => {
    const product = item.product as unknown as {
      id: string;
      name: string;
      images: string[];
      price: number;
      discount_price: number | null;
    };
    const price = product.discount_price || product.price;
    return {
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      product_image: product.images[0] || null,
      quantity: item.quantity,
      unit_price: price,
      total_price: price * item.quantity,
    };
  });

  await admin.from("order_items").insert(orderItems);

  // Create Razorpay order
  const razorpay = createRazorpayClient();
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(total * 100), // paise
    currency: "INR",
    receipt: order.id,
    notes: {
      order_id: order.id,
      order_number: orderNumber,
    },
  });

  // Store payment transaction
  await admin.from("payment_transactions").insert({
    order_id: order.id,
    razorpay_order_id: razorpayOrder.id,
    amount: total,
    status: "created",
  });

  // Increment coupon usage
  if (couponId) {
    await admin.rpc("increment_coupon_usage" as never, { coupon_id: couponId } as never);
  }

  return {
    orderId: order.id,
    orderNumber,
    razorpayOrderId: razorpayOrder.id,
    amount: total,
  };
}

export async function verifyPayment(
  orderId: string,
  razorpayPaymentId: string,
  razorpayOrderId: string,
  razorpaySignature: string
) {
  if (STORE_MODE === "OFFLINE") throw new Error("Store is currently offline");
  const admin = createAdminClient();

  const isValid = verifyRazorpaySignature(
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
  );

  if (!isValid) {
    await admin
      .from("payment_transactions")
      .update({ status: "failed", error_description: "Invalid signature" })
      .eq("order_id", orderId);
    throw new Error("Payment verification failed");
  }

  // Update payment transaction
  await admin
    .from("payment_transactions")
    .update({
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
      status: "captured",
    })
    .eq("order_id", orderId);

  // Update order status
  await admin
    .from("orders")
    .update({ status: "paid" })
    .eq("id", orderId);

  // Record paid status in history
  await admin
    .from("order_status_history")
    .insert({ order_id: orderId, status: "paid" });

  // Decrement stock and get order user_id in parallel
  const [{ data: orderItems }, { data: order }] = await Promise.all([
    admin.from("order_items").select("product_id, quantity").eq("order_id", orderId),
    admin.from("orders").select("user_id").eq("id", orderId).single(),
  ]);

  if (orderItems && orderItems.length > 0) {
    const items = orderItems
      .filter((i) => i.product_id)
      .map((i) => ({ product_id: i.product_id, quantity: i.quantity }));
    await admin.rpc("decrement_product_stock" as never, { items } as never);
  }

  // Clear user's cart
  if (order?.user_id) {
    await admin
      .from("cart_items")
      .delete()
      .eq("user_id", order.user_id);
  }

  return { success: true };
}

export async function applyCoupon(code: string, subtotal: number) {
  if (STORE_MODE === "OFFLINE") throw new Error("Store is currently offline");
  const supabase = await createClient();

  const { data: coupon } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("is_active", true)
    .single();

  if (!coupon) throw new Error("Invalid coupon code");

  if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
    throw new Error(
      `Minimum order amount is ₹${coupon.min_order_amount}`
    );
  }
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
    throw new Error("Coupon usage limit reached");
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    throw new Error("Coupon has expired");
  }

  const discountAmount =
    coupon.discount_type === "percentage"
      ? Math.round((subtotal * coupon.discount_value) / 100)
      : coupon.discount_value;

  return {
    code: coupon.code,
    discountAmount,
    description: coupon.description,
  };
}
