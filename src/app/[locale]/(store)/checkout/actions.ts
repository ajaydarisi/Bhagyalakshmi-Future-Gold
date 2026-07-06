"use server";

import { createClient, getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRazorpayClient } from "@/lib/razorpay/client";
import { verifyRazorpaySignature } from "@/lib/razorpay/verify";
import { generateOrderNumber } from "@/lib/formatters";
import {
  getCartLineUnitPrice,
  getRentalDays,
  isRentalOnlyProduct,
} from "@/lib/product-pricing";
import { getBookedRanges, maxConcurrentBooked } from "@/lib/rental-availability";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_COST, STORE_MODE } from "@/lib/constants";

type CheckoutProduct = {
  id: string;
  name: string;
  images: string[];
  stock: number;
  price: number;
  discount_price: number | null;
  is_sale: boolean;
  is_rental: boolean;
  rental_price: number | null;
  rental_discount_price: number | null;
  max_rental_days: number | null;
};

export async function createOrder(
  addressId: string,
  couponCode?: string | null
) {
  if (STORE_MODE === "OFFLINE") throw new Error("Store is currently offline");
  const supabase = await createClient();
  const admin = createAdminClient();

  const user = await getAuthUser(supabase);
  if (!user) throw new Error("Not authenticated");

  // Get cart items and shipping address in parallel
  const [{ data: cartItems }, { data: address }] = await Promise.all([
    supabase
      .from("cart_items")
      .select("quantity, rental_start, rental_end, product:products(*)")
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

  // Validate stock and rental periods.
  // ponytail: stock and coupon usage are validated here at order creation but
  // only committed at payment (decrement_product_stock / increment_coupon_usage).
  // Two concurrent last-unit checkouts can both pass this check, so a single-unit
  // oversell — or a coupon discount granted past max_uses — is possible. The RPCs
  // cap the counters (stock never goes negative, used_count never exceeds
  // max_uses), so the residual is a paid order without its decrement/one extra
  // discounted order. Full fix: reserve stock + coupon usage at order creation in
  // one transaction. Tracked as accepted debt.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const item of cartItems) {
    const product = item.product as unknown as CheckoutProduct;
    if (product.stock < item.quantity) {
      throw new Error(`${product.name} is out of stock`);
    }
    if (isRentalOnlyProduct(product)) {
      if (!item.rental_start || !item.rental_end) {
        throw new Error(`Please select rental dates for ${product.name}`);
      }
      const start = new Date(item.rental_start);
      const end = new Date(item.rental_end);
      if (end < start) {
        throw new Error(`Invalid rental dates for ${product.name}`);
      }
      if (start < today) {
        throw new Error(
          `Rental start date for ${product.name} has passed — please update it in your cart`
        );
      }
      const days = getRentalDays(item.rental_start, item.rental_end);
      if (product.max_rental_days && days > product.max_rental_days) {
        throw new Error(
          `${product.name} can be rented for at most ${product.max_rental_days} days`
        );
      }

      // Availability: units booked by confirmed orders on any overlapping day
      // must leave room for this line. Other buyers' recent pending orders act
      // as soft holds, but the caller's own pending orders are excluded so a
      // retried checkout isn't blocked by its own abandoned attempt.
      const ranges = await getBookedRanges(
        admin,
        product.id,
        item.rental_start,
        user.id
      );
      const peak = maxConcurrentBooked(ranges, item.rental_start, item.rental_end);
      if (peak + item.quantity > product.stock) {
        throw new Error(
          `${product.name} is not available for the selected dates — please choose a different period`
        );
      }
    }
  }

  const hasRental = cartItems.some((item) =>
    isRentalOnlyProduct(item.product as unknown as CheckoutProduct)
  );
  const hasSale = cartItems.some(
    (item) => !isRentalOnlyProduct(item.product as unknown as CheckoutProduct)
  );
  const orderType = hasRental ? (hasSale ? "mixed" : "rental") : "sale";

  // Calculate subtotal — rental-only items are priced at rental price/day × days
  const subtotal = cartItems.reduce((sum, item) => {
    const product = item.product as unknown as CheckoutProduct;
    const price = getCartLineUnitPrice(product, item.rental_start, item.rental_end);
    return sum + price * item.quantity;
  }, 0);

  // Apply coupon
  let discountAmount = 0;
  let couponId: string | null = null;

  if (couponCode) {
    // Coupons table has RLS with no read policy, so use the admin client to validate server-side.
    const { data: coupon } = await admin
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

  // Never let a fixed-amount coupon exceed the subtotal and push the charge
  // negative — clamp the discount to the subtotal.
  discountAmount = Math.min(discountAmount, subtotal);

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
      order_type: orderType,
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

  // Create order items. For rentals unit_price is the whole rental period for
  // one set, and rental_end doubles as the return-due date.
  const orderItems = cartItems.map((item) => {
    const product = item.product as unknown as CheckoutProduct;
    const isRental = isRentalOnlyProduct(product);
    const price = getCartLineUnitPrice(product, item.rental_start, item.rental_end);
    return {
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      product_image: product.images[0] || null,
      quantity: item.quantity,
      unit_price: price,
      total_price: price * item.quantity,
      is_rental: isRental,
      rental_start: isRental ? item.rental_start : null,
      rental_end: isRental ? item.rental_end : null,
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

  // Coupon usage is incremented only when the order is actually paid (see
  // verifyPayment / webhook), so abandoned checkouts don't consume a use.

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
      .eq("razorpay_order_id", razorpayOrderId);
    throw new Error("Payment verification failed");
  }

  // Resolve the order from the Razorpay order id, NOT the client-supplied
  // orderId. A valid signature only proves the (razorpayOrderId, paymentId)
  // pair is genuine — it does not prove it belongs to `orderId`. Without this
  // lookup a customer could pay a ₹1 order and replay that signature to mark an
  // unrelated expensive order as paid.
  const { data: transaction } = await admin
    .from("payment_transactions")
    .select("order_id")
    .eq("razorpay_order_id", razorpayOrderId)
    .single();

  if (!transaction || transaction.order_id !== orderId) {
    throw new Error("Payment verification failed");
  }
  const resolvedOrderId = transaction.order_id;

  // Update payment transaction (scoped to this Razorpay order)
  await admin
    .from("payment_transactions")
    .update({
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
      status: "captured",
    })
    .eq("razorpay_order_id", razorpayOrderId);

  // Update order status. The pending guard doubles as a fulfillment lock:
  // if the Razorpay webhook already processed this payment, no row
  // transitions and we skip the decrement/cart-clear so nothing runs twice.
  const { data: transitioned } = await admin
    .from("orders")
    .update({ status: "paid" })
    .eq("id", resolvedOrderId)
    .eq("status", "pending")
    .select("user_id, order_type, coupon_id");

  if (!transitioned || transitioned.length === 0) {
    return { success: true };
  }
  const order = transitioned[0];

  // Record paid status in history
  await admin
    .from("order_status_history")
    .insert({ order_id: resolvedOrderId, status: "paid" });

  // Count coupon usage now that payment succeeded (atomic, enforces max_uses)
  if (order.coupon_id) {
    await admin.rpc("increment_coupon_usage" as never, {
      coupon_id: order.coupon_id,
    } as never);
  }

  const { data: orderItems } = await admin
    .from("order_items")
    .select("product_id, quantity, is_rental")
    .eq("order_id", resolvedOrderId);

  // Rental lines never decrement stock — for rentals, stock is the rental
  // capacity and availability is computed per period from booked orders.
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
      .eq("id", resolvedOrderId);
  }

  // Clear user's cart
  if (order.user_id) {
    await admin
      .from("cart_items")
      .delete()
      .eq("user_id", order.user_id);
  }

  return { success: true };
}

export async function applyCoupon(code: string, subtotal: number) {
  if (STORE_MODE === "OFFLINE") throw new Error("Store is currently offline");
  // Coupons table has RLS with no read policy, so use the admin client to validate server-side.
  const admin = createAdminClient();

  const { data: coupon } = await admin
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
