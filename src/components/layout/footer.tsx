import Link from "next/link";
import { APP_NAME, CATEGORIES, ROUTES } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t bg-muted/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-primary"
            >
              ✦ {APP_NAME}
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">
              Discover exquisite fashion jewelry crafted with ❤️. From
              statement necklaces to delicate rings, find your perfect piece.
            </p>
          </div>

          {/* Categories */}
          <div>
            <h3 className="font-semibold">Categories</h3>
            <ul className="mt-3 space-y-2">
              {CATEGORIES.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={`${ROUTES.products}?category=${cat.slug}`}
                    className="text-sm text-muted-foreground hover:text-primary"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="font-semibold">Customer Service</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href={ROUTES.accountOrders}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  Track Order
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.cart}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  Shopping Cart
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.wishlist}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  Wishlist
                </Link>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="font-semibold">My Account</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href={ROUTES.account}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  Profile
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.accountAddresses}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  Addresses
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.login}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  Sign In
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t pt-6 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
