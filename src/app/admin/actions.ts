"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { productSchema, couponSchema } from "@/lib/validators";
import { generateSlug } from "@/lib/formatters";
import type { OrderStatus } from "@/types/order";

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function createProduct(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());

  const data = productSchema.parse({
    name: raw.name as string,
    slug: (raw.slug as string) || generateSlug(raw.name as string),
    description: (raw.description as string) || undefined,
    price: Number(raw.price),
    discount_price: raw.discount_price ? Number(raw.discount_price) : null,
    category_id: (raw.category_id as string) || null,
    stock: Number(raw.stock ?? 0),
    material: (raw.material as string) || null,
    tags: formData.getAll("tags") as string[],
    images: (formData.getAll("images") as string[]).filter(Boolean),
    is_active: raw.is_active === "true",
    featured: raw.featured === "true",
  });

  const supabase = createAdminClient();

  const { error } = await supabase.from("products").insert(data);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { success: true };
}

export async function updateProduct(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries());

  const data = productSchema.parse({
    name: raw.name as string,
    slug: (raw.slug as string) || generateSlug(raw.name as string),
    description: (raw.description as string) || undefined,
    price: Number(raw.price),
    discount_price: raw.discount_price ? Number(raw.discount_price) : null,
    category_id: (raw.category_id as string) || null,
    stock: Number(raw.stock ?? 0),
    material: (raw.material as string) || null,
    tags: formData.getAll("tags") as string[],
    images: (formData.getAll("images") as string[]).filter(Boolean),
    is_active: raw.is_active === "true",
    featured: raw.featured === "true",
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
  revalidatePath(`/admin/products/${id}/edit`);
  return { success: true };
}

export async function deleteProduct(id: string) {
  const supabase = createAdminClient();

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

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function createCategory(formData: FormData) {
  const name = formData.get("name") as string;
  const slug = (formData.get("slug") as string) || generateSlug(name);
  const description = (formData.get("description") as string) || null;
  const image_url = (formData.get("image_url") as string) || null;
  const sort_order = Number(formData.get("sort_order") ?? 0);

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("categories")
    .insert({ name, slug, description, image_url, sort_order });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/products");
  return { success: true };
}

export async function updateCategory(id: string, formData: FormData) {
  const name = formData.get("name") as string;
  const slug = (formData.get("slug") as string) || generateSlug(name);
  const description = (formData.get("description") as string) || null;
  const image_url = (formData.get("image_url") as string) || null;
  const sort_order = Number(formData.get("sort_order") ?? 0);

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("categories")
    .update({ name, slug, description, image_url, sort_order })
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
