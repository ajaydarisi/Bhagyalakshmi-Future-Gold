// Regression: ISSUE-003 — the wishlist/header/footer sign-in links pass
// usePathname(), which strips the locale, so `redirect=/products` reached the
// login form. It pushed that with the plain router, and localePrefix is
// "always", so a Telugu customer who signed in from /te/products landed on the
// English /en/products. Found by /qa on 2026-08-30.
// Report: .gstack/qa-reports/qa-report-localhost-2026-08-30.md
import { describe, expect, it } from "vitest";
import { isAbsoluteRedirectPath } from "@/i18n/config";

describe("isAbsoluteRedirectPath", () => {
  it("treats locale-stripped store paths as needing the locale re-attached", () => {
    for (const path of ["/products", "/wishlist", "/account/orders", "/"]) {
      expect(isAbsoluteRedirectPath(path), path).toBe(false);
    }
  });

  it("leaves already locale-prefixed paths alone", () => {
    for (const path of ["/te/products", "/en/products", "/te", "/en"]) {
      expect(isAbsoluteRedirectPath(path), path).toBe(true);
    }
  });

  it("leaves the proxy's unlocalized roots alone", () => {
    for (const path of ["/admin", "/admin/orders", "/api/x", "/auth/google", "/preview/slug"]) {
      expect(isAbsoluteRedirectPath(path), path).toBe(true);
    }
  });

  it("does not mistake a store path that merely starts with a locale's letters", () => {
    // "/entertainment" begins with "en" but is not the en locale, and
    // "/tempting" begins with "te". Both must keep their locale prefix.
    expect(isAbsoluteRedirectPath("/entertainment")).toBe(false);
    expect(isAbsoluteRedirectPath("/tempting")).toBe(false);
  });

  it("does not mistake a store path that merely starts with an unlocalized root", () => {
    expect(isAbsoluteRedirectPath("/administrators")).toBe(false);
    expect(isAbsoluteRedirectPath("/previews")).toBe(false);
  });
});
