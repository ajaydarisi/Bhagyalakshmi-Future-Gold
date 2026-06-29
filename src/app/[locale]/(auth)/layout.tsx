import { Link } from "@/i18n/routing";
import { APP_NAME } from "@/lib/constants";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { CartProvider } from "@/components/cart/cart-provider";
import { WishlistProvider } from "@/components/wishlist/wishlist-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tBrand = await getTranslations("constants.brandStory");

  return (
    <QueryProvider>
      <CartProvider>
        <WishlistProvider>
          <div className="grid min-h-screen lg:grid-cols-2">
            {/* Brand panel (desktop only) */}
            <div
              className="relative hidden flex-col justify-between overflow-hidden p-12 text-[var(--text-on-dark)] lg:flex"
              style={{ background: "var(--grad-ink)" }}
            >
              <Image
                src="/images/brand/hero-bridal.png"
                alt=""
                fill
                priority
                sizes="50vw"
                className="object-cover object-[center_20%] opacity-35"
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgb(28 24 18 / 0.55), rgb(28 24 18 / 0.82))" }} />

              <Link href="/" className="relative" aria-label={APP_NAME}>
                <Logo layout="horizontal" size="md" onDark />
              </Link>

              <div className="relative max-w-md bfg-animate">
                <span className="bfg-ornament mb-4 flex">
                  <span className="bfg-eyebrow">{APP_NAME}</span>
                </span>
                <h2 className="font-display text-4xl leading-tight">
                  <span className="bfg-foil">Adorn every occasion</span>
                </h2>
                <p className="mt-4 text-[var(--text-on-dark)]/75">{tBrand("short")}</p>
              </div>

              <p className="relative text-xs text-[var(--text-on-dark)]/50">
                &copy; {new Date().getFullYear()} {APP_NAME}
              </p>
            </div>

            {/* Form panel */}
            <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-10" style={{ background: "var(--bg-page)" }}>
              <div className="absolute right-3 top-3 flex items-center gap-1">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
              <Link href="/" className="mb-8 lg:hidden" aria-label={APP_NAME}>
                <Logo layout="stacked" size="md" />
              </Link>
              <div className="w-full max-w-md">{children}</div>
            </div>
          </div>
        </WishlistProvider>
      </CartProvider>
    </QueryProvider>
  );
}
