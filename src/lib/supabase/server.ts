import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Resolve the current user from the session JWT via getClaims().
 *
 * With asymmetric JWT signing keys this verifies the token locally with no
 * network round-trip — replacing the per-request getUser() call to the Supabase
 * auth server. On the legacy shared secret it transparently falls back to a
 * network verification, so this is always safe to use.
 */
export async function getAuthUser(supabase: ServerClient) {
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub as string,
    email: (claims.email as string | undefined) ?? null,
  };
}
