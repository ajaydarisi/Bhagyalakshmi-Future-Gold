"use client";

import { useAuth } from "@/hooks/use-auth";
import { BUSINESS_INFO, CATEGORIES, IS_ONLINE, ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { FeedbackDialog } from "@/components/feedback/feedback-form";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import Image from "next/image";
import { Link, useRouter, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function Footer() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("footer");
  const tc = useTranslations("constants");
  const tCommon = useTranslations();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success(tCommon("signedOut"));
    router.push("/");
    router.refresh();
  }
  return (
    <footer className="border-t">
      {/* Newsletter / Community section */}
      <div className="container mx-auto px-4 py-16 text-center border-b">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
          {t("stayInTouch")}
        </p>
        <h3 className="text-2xl md:text-3xl mb-3">
          {t("joinWorld")}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {t("joinDescription")}
        </p>
      </div>

      {/* Links grid */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div>
            <Link
              href="/"
              className="flex items-center gap-2 font-brand text-lg tracking-wide text-primary"
            >
              <Image src="/images/logo.svg" alt="" width={20} height={20} />
              {tCommon("appName")}
            </Link>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              {t("brandDescription")}
            </p>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-xs uppercase tracking-[0.15em] font-medium mb-4">
              {t("categories")}
            </h3>
            <ul className="space-y-2.5">
              {CATEGORIES.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={`${ROUTES.products}?category=${cat.slug}`}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {tc(`categories.${cat.slug}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Care */}
          <div>
            <h3 className="text-xs uppercase tracking-[0.15em] font-medium mb-4">
              {t("customerCare")}
            </h3>
            <ul className="space-y-2.5">
              {IS_ONLINE && (
                <li>
                  <Link
                    href={ROUTES.accountOrders}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {t("trackOrder")}
                  </Link>
                </li>
              )}
              {IS_ONLINE && (
                <li>
                  <Link
                    href={ROUTES.cart}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {t("shoppingBag")}
                  </Link>
                </li>
              )}
              <li>
                <Link
                  href={ROUTES.wishlist}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {t("wishlist")}
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.about}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {t("aboutUs")}
                </Link>
              </li>
              <li>
                <FeedbackDialog>
                  <button className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    {t("feedback")}
                  </button>
                </FeedbackDialog>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="text-xs uppercase tracking-[0.15em] font-medium mb-4">
              {t("myAccount")}
            </h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href={ROUTES.account}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {t("profile")}
                </Link>
              </li>
              {IS_ONLINE && (
                <li>
                  <Link
                    href={ROUTES.accountAddresses}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {t("addresses")}
                  </Link>
                </li>
              )}
              <li>
                {user ? (
                  <button
                    onClick={handleSignOut}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {tCommon("nav.signOut")}
                  </button>
                ) : (
                  <Link
                    href={pathname === "/" ? ROUTES.login : `${ROUTES.login}?redirect=${encodeURIComponent(pathname)}`}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {tCommon("nav.signIn")}
                  </Link>
                )}
              </li>
            </ul>
          </div>

          {/* Visit Our Store */}
          <div>
            <h3 className="text-xs uppercase tracking-[0.15em] font-medium mb-4">
              {t("visitOurStore")}
            </h3>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  {[
                    BUSINESS_INFO.address.street,
                    BUSINESS_INFO.address.city,
                    `${BUSINESS_INFO.address.district} Dist.`,
                    BUSINESS_INFO.address.state,
                    BUSINESS_INFO.address.pincode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </li>
              {BUSINESS_INFO.phone && (
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <a
                    href={`tel:${BUSINESS_INFO.phone}`}
                    className="hover:text-primary transition-colors"
                  >
                    {BUSINESS_INFO.phone}
                  </a>
                </li>
              )}
              {BUSINESS_INFO.email && (
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <a
                    href={`mailto:${BUSINESS_INFO.email}`}
                    className="hover:text-primary transition-colors"
                  >
                    {BUSINESS_INFO.email}
                  </a>
                </li>
              )}
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                <span>Mon–Sat: {BUSINESS_INFO.hours.weekdays}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t pt-6 text-center text-xs text-muted-foreground tracking-wide">
          <p>&copy; {new Date().getFullYear()} {tCommon("appName")}. {t("allRightsReserved")}</p>
        </div>
      </div>
    </footer>
  );
}
