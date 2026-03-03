import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Increase from default 10s — native WebViews (Capacitor) can be
        // slow to release Navigator LockManager locks after app resume.
        lockAcquireTimeout: 20_000,
      },
    }
  );
  return client;
}
