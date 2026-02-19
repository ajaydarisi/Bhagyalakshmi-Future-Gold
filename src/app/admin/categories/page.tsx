import { createAdminClient } from "@/lib/supabase/admin";
import { CategoriesManager } from "@/components/admin/categories-manager";

export default async function AdminCategoriesPage() {
  const supabase = createAdminClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Categories</h1>
      <CategoriesManager categories={categories ?? []} />
    </div>
  );
}
