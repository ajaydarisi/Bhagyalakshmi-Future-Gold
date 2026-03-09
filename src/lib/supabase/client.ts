import { createBrowserClient } from "@supabase/ssr";
import { Capacitor } from "@capacitor/core";

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
        // Bypass Navigator LockManager entirely on Capacitor native platforms.
        // WebViews are single-tab so the multi-tab lock provides no value and
        // can deadlock after long background periods, causing auth state to
        // never resolve (sign-in/sign-out buttons disappear).
        ...(Capacitor.isNativePlatform() && {
          lock: async (
            _name: string,
            _acquireTimeout: number,
            fn: () => Promise<unknown>
          ) => fn(),
        }),
      } as Record<string, unknown>,
    }
  );
  return client;
}
