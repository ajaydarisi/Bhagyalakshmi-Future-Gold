import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip i18n for admin, API, and preview routes.
  if (
    pathname.startsWith("/.well-known") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/preview")
  ) {
    return await updateSession(request);
  }

  // Preserve locale routing headers/cookies while refreshing the session.
  const intlResponse = intlMiddleware(request);
  return await updateSession(request, intlResponse);
}

export const config = {
  matcher: [
    // Public files must bypass locale routing. AudioWorklet modules reject a
    // localized redirect or 404.
    "/((?!_next/static|_next/image|.*\\..*).*)",
  ],
};
