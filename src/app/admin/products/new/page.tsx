import { createAdminClient } from "@/lib/supabase/admin";
import { ProductForm } from "@/components/admin/product-form";

export default async function NewProductPage() {
  const supabase = createAdminClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">New Product</h1>
      <ProductForm categories={categories ?? []} />
    </div>
  );
}
