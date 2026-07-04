"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { productSchema, couponSchema, categorySchema } from "@/lib/validators";
import { generateSlug } from "@/lib/formatters";
import { sendOrderStatusNotification } from "@/lib/notifications";
import {
  removeProductRetrievalDocument,
  syncProductRetrievalDocument,
  syncProductRetrievalDocuments,
} from "@/lib/retrieval/catalog";
import type { OrderStatus } from "@/types/order";
import * as deepl from "deepl-node";

/**
 * Authorization gate for every admin mutation. Server actions are directly
 * invocable POST endpoints, so the admin/layout.tsx page guard does NOT protect
 * them — each action must verify the caller is an admin itself. Throws if not.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Forbidden");
}

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

export async function translateToTelugu(
  text: string
): Promise<{ translation: string } | { error: string }> {
  await requireAdmin();
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

async function getActiveProductIdsForCategories(
  categoryIds: string[]
): Promise<string[]> {
  if (categoryIds.length === 0) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .in("category_id", categoryIds)
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((product) => product.id);
}

async function getCategoryDescendantIds(categoryId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, parent_id");

  if (error) {
    throw new Error(error.message);
  }

  const descendants = new Set<string>([categoryId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const category of data ?? []) {
      if (category.parent_id && descendants.has(category.parent_id) && !descendants.has(category.id)) {
        descendants.add(category.id);
        changed = true;
      }
    }
  }

  return [...descendants];
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());

  const data = productSchema.parse({
    name: raw.name as string,
    name_telugu: (raw.name_telugu as string) || null,
    slug: (raw.slug as string) || generateSlug(raw.name as string),
    description: (raw.description as string) || undefined,
    description_telugu: (raw.description_telugu as string) || null,
    price: Math.round(Number(raw.price) * 100) / 100,
    discount_price: raw.discount_price ? Math.round(Number(raw.discount_price) * 100) / 100 : null,
    category_id: (raw.category_id as string) || null,
    stock: Number(raw.stock ?? 0),
    material: (raw.material as string) || null,
    tags: formData.getAll("tags") as string[],
    images: (formData.getAll("images") as string[]).filter(Boolean),
    is_active: raw.is_active === "true",
    featured: raw.featured === "true",
    is_sale: raw.is_sale === "true",
    is_rental: raw.is_rental === "true",
    rental_price: raw.rental_price ? Math.round(Number(raw.rental_price) * 100) / 100 : null,
    rental_discount_price: raw.rental_discount_price ? Math.round(Number(raw.rental_discount_price) * 100) / 100 : null,
    rental_deposit: raw.rental_deposit ? Math.round(Number(raw.rental_deposit) * 100) / 100 : null,
    max_rental_days: raw.max_rental_days ? Number(raw.max_rental_days) : null,
    set_number: raw.set_number ? Number(raw.set_number) : null,
  });

  const supabase = createAdminClient();

  // Deduplicate slug: if it already exists, append a random suffix
  let slug = data.slug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!existing) break;

    const suffix = Math.random().toString(36).substring(2, 6);
    slug = `${data.slug}-${suffix}`;
  }

  const { data: inserted, error } = await supabase
    .from("products")
    .insert({ ...data, slug })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  let retrievalStatus: "ready" | "failed" = "ready";
  let warning: string | undefined;

  try {
    retrievalStatus = await syncProductRetrievalDocument(inserted.id);
  } catch (retrievalError) {
    retrievalStatus = "failed";
    warning =
      retrievalError instanceof Error
        ? retrievalError.message
        : "Product saved, but semantic indexing is pending.";
  }

  if (retrievalStatus === "failed" && !warning) {
    warning = "Product saved, but semantic indexing is pending.";
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/search");
  revalidatePath(`/products/${slug}`);
  return {
    success: true,
    productId: inserted.id,
    retrievalStatus,
    ...(warning ? { warning } : {}),
  };
}

export async function updateProduct(id: string, formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());

  const data = productSchema.parse({
    name: raw.name as string,
    name_telugu: (raw.name_telugu as string) || null,
    slug: (raw.slug as string) || generateSlug(raw.name as string),
    description: (raw.description as string) || undefined,
    description_telugu: (raw.description_telugu as string) || null,
    price: Math.round(Number(raw.price) * 100) / 100,
    discount_price: raw.discount_price ? Math.round(Number(raw.discount_price) * 100) / 100 : null,
    category_id: (raw.category_id as string) || null,
    stock: Number(raw.stock ?? 0),
    material: (raw.material as string) || null,
    tags: formData.getAll("tags") as string[],
    images: (formData.getAll("images") as string[]).filter(Boolean),
    is_active: raw.is_active === "true",
    featured: raw.featured === "true",
    is_sale: raw.is_sale === "true",
    is_rental: raw.is_rental === "true",
    rental_price: raw.rental_price ? Math.round(Number(raw.rental_price) * 100) / 100 : null,
    rental_discount_price: raw.rental_discount_price ? Math.round(Number(raw.rental_discount_price) * 100) / 100 : null,
    rental_deposit: raw.rental_deposit ? Math.round(Number(raw.rental_deposit) * 100) / 100 : null,
    max_rental_days: raw.max_rental_days ? Number(raw.max_rental_days) : null,
    set_number: raw.set_number ? Number(raw.set_number) : null,
  });

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("products")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  let retrievalStatus: "ready" | "failed" = "ready";
  let warning: string | undefined;

  try {
    retrievalStatus = await syncProductRetrievalDocument(id);
  } catch (retrievalError) {
    retrievalStatus = "failed";
    warning =
      retrievalError instanceof Error
        ? retrievalError.message
        : "Product updated, but semantic indexing is pending.";
  }

  if (retrievalStatus === "failed" && !warning) {
    warning = "Product updated, but semantic indexing is pending.";
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/search");
  revalidatePath(`/products/${data.slug}`);
  revalidatePath(`/admin/products/${id}/edit`);
  return {
    success: true,
    retrievalStatus,
    ...(warning ? { warning } : {}),
  };
}

export async function deleteProduct(id: string) {
  await requireAdmin();
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

  await removeProductRetrievalDocument(id).catch((retrievalError) => {
    console.error("Failed to remove retrieval document:", retrievalError);
  });

  revalidatePath("/", "layout");
  revalidatePath("/products");
  revalidatePath("/search");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error) {
    return { error: error.message };
  }

  // Rental lifecycle: delivery puts the rental in the customer's hands
  if (status === "delivered") {
    await supabase
      .from("orders")
      .update({ rental_status: "active" })
      .eq("id", orderId)
      .neq("order_type", "sale");
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

export async function markRentalReturned(orderId: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("orders")
    .update({ rental_status: "returned", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .neq("order_type", "sale")
    .select("id");

  if (error) {
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "Not a rental order" };
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);

  return { success: true };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

function parseCategoryFormData(formData: FormData) {
  const name = (formData.get("name") as string) ?? "";
  return categorySchema.safeParse({
    name,
    name_telugu: (formData.get("name_telugu") as string) || null,
    slug: (formData.get("slug") as string) || generateSlug(name),
    description: (formData.get("description") as string) || null,
    image_url: (formData.get("image_url") as string) || null,
    sort_order: Number(formData.get("sort_order") ?? 0),
    parent_id: (formData.get("parent_id") as string) || null,
  });
}

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const parsed = parseCategoryFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid category data" };
  }

  const supabase = createAdminClient();

  const { error } = await supabase.from("categories").insert(parsed.data);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/products");
  return { success: true };
}

export async function updateCategory(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = parseCategoryFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid category data" };
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("categories")
    .update(parsed.data)
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  const productIds = await getActiveProductIdsForCategories([id]).catch(
    (reindexError) => {
      console.error("Failed to collect products for category reindex:", reindexError);
      return [];
    }
  );

  if (productIds.length > 0) {
    await syncProductRetrievalDocuments(productIds).catch((reindexError) => {
      console.error("Failed to reindex products after category update:", reindexError);
    });
  }

  revalidatePath("/admin/categories");
  revalidatePath("/products");
  revalidatePath("/search");
  return { success: true };
}

export async function deleteCategory(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  const categoryIds = await getCategoryDescendantIds(id).catch((descendantError) => {
    console.error("Failed to collect descendant categories:", descendantError);
    return [id];
  });
  const affectedProductIds = await getActiveProductIdsForCategories(categoryIds).catch(
    (reindexError) => {
      console.error("Failed to collect products for category delete reindex:", reindexError);
      return [];
    }
  );

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  if (affectedProductIds.length > 0) {
    await syncProductRetrievalDocuments(affectedProductIds).catch((reindexError) => {
      console.error("Failed to reindex products after category delete:", reindexError);
    });
  }

  revalidatePath("/admin/categories");
  revalidatePath("/products");
  revalidatePath("/search");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function updateUserRole(
  userId: string,
  role: "customer" | "admin"
) {
  await requireAdmin();
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
  await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function toggleUserDisabled(userId: string, disable: boolean) {
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase.from("coupons").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/coupons");
  return { success: true };
}
