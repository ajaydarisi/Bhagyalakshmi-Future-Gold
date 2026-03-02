import { Link } from "@/i18n/routing";
import { APP_NAME } from "@/lib/constants";
import { Header } from "@/components/layout/header";
import { CartProvider } from "@/components/cart/cart-provider";
import { WishlistProvider } from "@/components/wishlist/wishlist-provider";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <WishlistProvider>
        <div className="flex min-h-screen flex-col bg-muted/50">
          <Header />
          <div className="flex flex-1 flex-col items-center justify-center px-4">
            <Link
              href="/"
              className="mb-8 flex flex-col items-center gap-2 text-2xl font-brand tracking-wide text-primary"
            >
              <Image
                src="/images/logo.png"
                alt={APP_NAME}
                width={200}
                height={200}
                className="h-32 w-auto rounded-lg"
              />
              {APP_NAME}
            </Link>
            <div className="w-full max-w-md">{children}</div>
          </div>
        </div>
      </WishlistProvider>
    </CartProvider>
  );
}
