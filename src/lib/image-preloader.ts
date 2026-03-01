export function preloadProductImages(imageUrls: string[]): void {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    !navigator.serviceWorker.controller
  ) {
    return;
  }

  // Only preload Supabase storage images
  const supabaseUrls = imageUrls.filter(
    (url) => url.includes("supabase.co") && url.includes("/storage/"),
  );
  if (supabaseUrls.length === 0) return;

  navigator.serviceWorker.controller.postMessage({
    type: "PRELOAD_IMAGES",
    urls: supabaseUrls,
  });
}
