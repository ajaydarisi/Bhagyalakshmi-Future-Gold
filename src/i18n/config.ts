export const locales = ["en", "te"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

/** Roots the proxy exempts from locale prefixing. Mirrors `src/proxy.ts`. */
const UNLOCALIZED_ROOTS = ["/admin", "/api", "/auth", "/preview", "/.well-known"];
const LOCALE_PREFIXED = new RegExp(`^/(?:${locales.join("|")})(?:/|$)`);

/**
 * Whether a post-login `redirect` value is already a complete path.
 *
 * The param arrives in two shapes: locale-stripped store paths from
 * `usePathname()` ("/products") and absolute unlocalized ones ("/admin").
 * `localePrefix` is "always", so pushing a bare store path with the plain
 * router resolves it against the default locale — a Telugu customer who signs
 * in from a wishlist button lands back in English. Absolute paths must stay
 * untouched; the rest need the locale re-attached by the i18n router.
 *
 * Lives here rather than in routing.ts so it stays free of next-intl's client
 * navigation import, which needs the Next runtime to load.
 */
export function isAbsoluteRedirectPath(path: string) {
  if (LOCALE_PREFIXED.test(path)) return true;
  return UNLOCALIZED_ROOTS.some(
    (root) => path === root || path.startsWith(`${root}/`),
  );
}
