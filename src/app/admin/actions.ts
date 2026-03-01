"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { productSchema, couponSchema } from "@/lib/validators";
import { generateSlug } from "@/lib/formatters";
import { sendOrderStatusNotification } from "@/lib/notifications";
import type { OrderStatus } from "@/types/order";
import * as deepl from "deepl-node";

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

export async function translateToTelugu(
  text: string
): Promise<{ translation: string } | { error: string }> {
  const authKey = process.env.DEEPL_AUTH_KEY;
  if (!authKey) {
    return { error: "DeepL API key is not configured" };
  }

  try {
    const translator = new deepl.Translator(authKey);
    const result = await translator.translateText(
      text,
      null,
      "te" as deepl.TargetLanguageCode
    );

    const translated = Array.isArray(result) ? result[0].text : result.text;
    return { translation: translated };
  } catch (e) {
    return { error: `Translation failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function createProduct(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());

  const data = productSchema.parse({
    name: raw.name as string,
    name_telugu: (raw.name_telugu as string) || null,
    slug: (raw.slug as string) || generateSlug(raw.name as string),
    description: (raw.description as string) || undefined,
    description_telugu: (raw.description_telugu as string) || null,
    price: Number(raw.price),
    discount_price: raw.discount_price ? Number(raw.discount_price) : null,
    category_id: (raw.category_id as string) || null,
    stock: Number(raw.stock ?? 0),
    material: (raw.material as string) || null,
    tags: formData.getAll("tags") as string[],
    images: (formData.getAll("images") as string[]).filter(Boolean),
    is_active: raw.is_active === "true",
    featured: raw.featured === "true",
    is_sale: raw.is_sale === "true",
    is_rental: raw.is_rental === "true",
    rental_price: raw.rental_price ? Number(raw.rental_price) : null,
    rental_discount_price: raw.rental_discount_price ? Number(raw.rental_discount_price) : null,
    rental_deposit: raw.rental_deposit ? Number(raw.rental_deposit) : null,
    max_rental_days: raw.max_rental_days ? Number(raw.max_rental_days) : null,
  });

  const supabase = createAdminClient();

  const { data: inserted, error } = await supabase
    .from("products")
    .insert(data)
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath(`/products/${data.slug}`);
  return { success: true, productId: inserted.id };
}

export async function updateProduct(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries());

  const data = productSchema.parse({
    name: raw.name as string,
    name_telugu: (raw.name_telugu as string) || null,
    slug: (raw.slug as string) || generateSlug(raw.name as string),
    description: (raw.description as string) || undefined,
    description_telugu: (raw.description_telugu as string) || null,
    price: Number(raw.price),
    discount_price: raw.discount_price ? Number(raw.discount_price) : null,
    category_id: (raw.category_id as string) || null,
    stock: Number(raw.stock ?? 0),
    material: (raw.material as string) || null,
    tags: formData.getAll("tags") as string[],
    images: (formData.getAll("images") as string[]).filter(Boolean),
    is_active: raw.is_active === "true",
    featured: raw.featured === "true",
    is_sale: raw.is_sale === "true",
    is_rental: raw.is_rental === "true",
    rental_price: raw.rental_price ? Number(raw.rental_price) : null,
    rental_discount_price: raw.rental_discount_price ? Number(raw.rental_discount_price) : null,
    rental_deposit: raw.rental_deposit ? Number(raw.rental_deposit) : null,
    max_rental_days: raw.max_rental_days ? Number(raw.max_rental_days) : null,
  });

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("products")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath(`/products/${data.slug}`);
  revalidatePath(`/admin/products/${id}/edit`);
  return { success: true };
}

export async function deleteProduct(id: string) {
  const supabase = createAdminClient();

  // Fetch product images so we can clean up storage
  const { data: product } = await supabase
    .from("products")
    .select("images")
    .eq("id", id)
    .single();

  if (product?.images?.length) {
    const BUCKET = "product-images";
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const paths = product.images
      .map((url: string) => {
        const idx = url.indexOf(marker);
        return idx !== -1 ? url.slice(idx + marker.length) : null;
      })
      .filter(Boolean) as string[];

    if (paths.length) {
      await supabase.storage.from(BUCKET).remove(paths);
    }
  }

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error) {
    return { error: error.message };
  }

  // Record status change in history
  await supabase
    .from("order_status_history")
    .insert({ order_id: orderId, status })
    .then(({ error: histError }) => {
      if (histError) console.error("Failed to record status history:", histError.message);
    });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);

  // Send push notification for order status change
  sendOrderStatusNotification(orderId, status).catch(console.error);

  return { success: true };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function createCategory(formData: FormData) {
  const name = formData.get("name") as string;
  const name_telugu = (formData.get("name_telugu") as string) || null;
  const slug = (formData.get("slug") as string) || generateSlug(name);
  const description = (formData.get("description") as string) || null;
  const image_url = (formData.get("image_url") as string) || null;
  const sort_order = Number(formData.get("sort_order") ?? 0);
  const parent_id = (formData.get("parent_id") as string) || null;

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("categories")
    .insert({ name, name_telugu, slug, description, image_url, sort_order, parent_id });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/products");
  return { success: true };
}

export async function updateCategory(id: string, formData: FormData) {
  const name = formData.get("name") as string;
  const name_telugu = (formData.get("name_telugu") as string) || null;
  const slug = (formData.get("slug") as string) || generateSlug(name);
  const description = (formData.get("description") as string) || null;
  const image_url = (formData.get("image_url") as string) || null;
  const sort_order = Number(formData.get("sort_order") ?? 0);
  const parent_id = (formData.get("parent_id") as string) || null;

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("categories")
    .update({ name, name_telugu, slug, description, image_url, sort_order, parent_id })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/products");
  return { success: true };
}

export async function deleteCategory(id: string) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/products");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function updateUserRole(
  userId: string,
  role: "customer" | "admin"
) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function deleteUser(userId: string) {
  const supabase = createAdminClient();

  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function toggleUserDisabled(userId: string, disable: boolean) {
  const supabase = createAdminClient();

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: disable ? "876600h" : "none",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export async function createCoupon(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());

  const data = couponSchema.parse({
    code: raw.code as string,
    description: (raw.description as string) || undefined,
    discount_type: raw.discount_type as "percentage" | "fixed",
    discount_value: Number(raw.discount_value),
    min_order_amount: Number(raw.min_order_amount ?? 0),
    max_uses: raw.max_uses ? Number(raw.max_uses) : null,
    is_active: raw.is_active === "true",
    expires_at: (raw.expires_at as string) || null,
  });

  const supabase = createAdminClient();

  const { error } = await supabase.from("coupons").insert(data);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/coupons");
  return { success: true };
}

export async function updateCoupon(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries());

  const data = couponSchema.parse({
    code: raw.code as string,
    description: (raw.description as string) || undefined,
    discount_type: raw.discount_type as "percentage" | "fixed",
    discount_value: Number(raw.discount_value),
    min_order_amount: Number(raw.min_order_amount ?? 0),
    max_uses: raw.max_uses ? Number(raw.max_uses) : null,
    is_active: raw.is_active === "true",
    expires_at: (raw.expires_at as string) || null,
  });

  const supabase = createAdminClient();

  const { error } = await supabase.from("coupons").update(data).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/coupons");
  return { success: true };
}

export async function deleteCoupon(id: string) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("coupons").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/coupons");
  return { success: true };
}
