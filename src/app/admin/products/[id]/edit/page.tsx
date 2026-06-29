import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductForm } from "@/components/admin/product-form";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: EditProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: product } = await supabase
    .from("products")
    .select("name")
    .eq("id", id)
    .single();
  return { title: product?.name ?? "Edit Product" };
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase.from("categories").select("*").order("sort_order"),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-text-primary md:text-4xl">Edit Product</h1>
      <ProductForm product={product} categories={categories ?? []} />
    </div>
  );
}
