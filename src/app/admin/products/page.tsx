import Link from "next/link";
import { Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { ProductsTable } from "@/components/admin/products-table";

export default async function AdminProductsPage() {
  const supabase = createAdminClient();

  const { data: products } = await supabase
    .from("products")
    .select("*, category:categories(name, slug)")
    .order("created_at", { ascending: false });

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Products</h1>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="size-4" />
            Add Product
          </Link>
        </Button>
      </div>

      <ProductsTable products={products ?? []} />
    </div>
  );
}
