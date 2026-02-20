import { createClient } from "./client";

const BUCKET = "product-images";

export async function uploadProductImage(file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return publicUrl;
}

export async function deleteProductImage(url: string): Promise<void> {
  const supabase = createClient();
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;

  const path = url.slice(idx + marker.length);
  await supabase.storage.from(BUCKET).remove([path]);
}
