import { createAdminClient } from "@/lib/supabase/admin";
import { unstable_cache } from "next/cache";

export type NavCategory = {
  name: string;
  name_telugu: string | null;
  slug: string;
};

export const getTopCategories = unstable_cache(
  async (): Promise<NavCategory[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("categories")
      .select("name, name_telugu, slug")
      .is("parent_id", null)
      .order("sort_order");
    return data ?? [];
  },
  ["top-categories"],
  { revalidate: 300 }
);
