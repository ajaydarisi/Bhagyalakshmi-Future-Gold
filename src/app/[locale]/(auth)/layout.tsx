import { Link } from "@/i18n/routing";
import { APP_NAME } from "@/lib/constants";
import { Header } from "@/components/layout/header";
import { CartProvider } from "@/components/cart/cart-provider";
import { WishlistProvider } from "@/components/wishlist/wishlist-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { getTopCategories } from "@/lib/queries";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [categories, t] = await Promise.all([
    getTopCategories(),
    getTranslations("auth.brand"),
  ]);

  return (
    <QueryProvider>
      <CartProvider>
        <WishlistProvider>
          <div className="flex min-h-screen flex-col bg-muted/50">
            <Header categories={categories} />
            <div className="grid flex-1 lg:grid-cols-2">
              {/* Brand panel — editorial bridal image, large screens only */}
              <div className="relative hidden overflow-hidden lg:block">
                <Image
                  src="/images/hero.png"
                  alt=""
                  fill
                  priority
                  sizes="50vw"
                  className="object-cover object-[60%_30%]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/35 to-foreground/10" />
                <div className="absolute inset-x-0 bottom-0 p-12">
                  <p className="bfg-ornament text-xs uppercase tracking-[0.25em] text-[oklch(0.85_0.09_82)]">
                    {APP_NAME}
                  </p>
                  <h2 className="mt-4 max-w-md font-heading text-4xl leading-tight text-white">
                    {t("tagline")}
                  </h2>
                  <p className="mt-3 max-w-sm text-sm text-white/75">{t("subtitle")}</p>
                </div>
              </div>

              {/* Form column */}
              <div className="flex flex-col items-center justify-center px-4 py-10">
                <Link
                  href="/"
                  className="mb-8 flex flex-col items-center gap-2 text-2xl font-brand tracking-wide text-primary"
                >
                  <Image
                    src="/images/logo.png"
                    alt={APP_NAME}
                    width={200}
                    height={200}
                    className="h-28 w-auto rounded-lg"
                  />
                  {APP_NAME}
                </Link>
                <div className="w-full max-w-md">{children}</div>
              </div>
            </div>
          </div>
        </WishlistProvider>
      </CartProvider>
    </QueryProvider>
  );
}
