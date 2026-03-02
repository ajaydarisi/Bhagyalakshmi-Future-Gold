import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WishlistContent } from "./wishlist-content";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { getTranslations } from "next-intl/server";
import type { ProductWithCategory } from "@/types/product";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("wishlist");
  return {
    title: t("title"),
  };
}

export default async function WishlistPage() {
  const t = await getTranslations("wishlist");
  const tRoot = await getTranslations();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/wishlist");
  }

  const { data: wishlistItems } = await supabase
    .from("wishlist_items")
    .select("product_id, product:products(*, category:categories(name, name_telugu, slug))")
    .eq("user_id", user.id);

  const products = (wishlistItems || [])
    .map((item) => item.product)
    .filter(Boolean) as unknown as ProductWithCategory[];

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={[{ label: t("breadcrumb") }]} homeLabel={tRoot("breadcrumbHome")} />
      <h1 className="mt-6 text-2xl font-bold md:text-3xl">{t("title")}</h1>
      <WishlistContent initialProducts={products} userId={user.id} />
    </div>
  );
}
