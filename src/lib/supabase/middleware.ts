import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { locales } from "@/i18n/config";

const STORE_MODE = (process.env.NEXT_PUBLIC_STORE_MODE || "ONLINE").toUpperCase();

const OFFLINE_DISABLED_ROUTES = [
  "/cart",
  "/checkout",
  "/account/orders",
  "/account/addresses",
];

// Strip locale prefix from pathname for route matching
function stripLocale(pathname: string): string {
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return pathname.slice(`/${locale}`.length) || "/";
    }
  }
  return pathname;
}

export async function updateSession(
  request: NextRequest,
  response?: NextResponse
) {
  let supabaseResponse =
    response ??
    NextResponse.next({
      request,
    });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          if (!response) {
            supabaseResponse = NextResponse.next({
              request,
            });
          }
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Use getUser() to verify the token with Supabase server.
  // getSession() only reads from cookies without verification, which can
  // cause stale/expired sessions to appear valid and break auth flows.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const strippedPath = stripLocale(pathname);

  // In OFFLINE mode, redirect disabled routes to home
  if (STORE_MODE === "OFFLINE") {
    const isDisabled = OFFLINE_DISABLED_ROUTES.some(
      (route) =>
        strippedPath === route || strippedPath.startsWith(route + "/")
    );
    if (isDisabled) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // Protect account routes - require login and valid (non-banned/deleted) user
  if (strippedPath.startsWith("/account")) {
    if (!user) {
      const url = request.nextUrl.clone();
      const localePrefix = pathname.replace(strippedPath, "");
      url.pathname = `${localePrefix}/login`;
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }

  // Protect admin routes - require login + admin role
  if (pathname.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    // Check admin role (user is already verified via getUser() above)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // Redirect logged-in users away from auth pages
  if (
    user &&
    (strippedPath.startsWith("/login") ||
      strippedPath.startsWith("/signup") ||
      strippedPath.startsWith("/forgot-password"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
