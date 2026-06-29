import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { CategoriesManager } from "@/components/admin/categories-manager";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  const supabase = createAdminClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-text-primary md:text-4xl">Categories</h1>
      <CategoriesManager categories={categories ?? []} />
    </div>
  );
}
