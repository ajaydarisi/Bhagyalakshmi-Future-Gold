import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductForm } from "@/components/admin/product-form";
import type { Product } from "@/types/product";

export const metadata: Metadata = { title: "New Product" };

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ copyFrom?: string }>;
}) {
  const supabase = createAdminClient();
  const { copyFrom } = await searchParams;

  const [{ data: categories }, sourceProduct] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    copyFrom
      ? supabase
          .from("products")
          .select("*")
          .eq("id", copyFrom)
          .single()
          .then(({ data }) => data as Product | null)
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">New Product</h1>
      <ProductForm
        categories={categories ?? []}
        copyFrom={sourceProduct ?? undefined}
      />
    </div>
  );
}
