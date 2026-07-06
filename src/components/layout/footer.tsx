"use client";

import { useAuth } from "@/hooks/use-auth";
import { BUSINESS_INFO, IS_ONLINE, ROUTES } from "@/lib/constants";
import { getCategoryName } from "@/lib/i18n-helpers";
import type { NavCategory } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { FeedbackDialog } from "@/components/feedback/feedback-form";
import { Logo } from "@/components/brand/logo";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import Image from "next/image";
import { Link, useRouter, usePathname } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

const supabase = createClient();

export function Footer({ categories }: { categories: NavCategory[] }) {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("footer");
  const tCommon = useTranslations();
  const locale = useLocale();

  async function handleSignOut() {
    try {
      await supabase.auth.signOut({ scope: "local" });
      toast.success(tCommon("signedOut"));
      router.push("/");
      router.refresh();
    } catch {
      toast.error(tCommon("error.title"));
      router.refresh();
    }
  }
  const linkCls = "text-sm text-[var(--text-on-dark)]/75 hover:text-gold-300 transition-colors";
  const headingCls = "text-xs uppercase tracking-[0.18em] font-medium mb-4 text-gold-300 font-brand";

  return (
    <footer className="hidden lg:block text-[var(--text-on-dark)]" style={{ background: "var(--grad-ink)" }}>
      {/* Newsletter / Community section */}
      <div className="container mx-auto px-4 py-16 text-center border-b border-white/10">
        <span className="bfg-ornament mb-3 justify-center">
          <span className="text-xs uppercase tracking-[0.22em] font-brand text-gold-300">
            {t("stayInTouch")}
          </span>
        </span>
        <h3 className="font-display text-3xl md:text-4xl mb-3 text-[var(--text-on-dark)]">
          {t("joinWorld")}
        </h3>
        <p className="text-sm text-[var(--text-on-dark)]/70 max-w-md mx-auto">
          {t("joinDescription")}
        </p>
      </div>

      {/* Links grid */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div>
            <Link href="/" aria-label={tCommon("appName")}>
              <Logo layout="horizontal" size="sm" onDark />
            </Link>
            <p className="mt-4 text-sm text-[var(--text-on-dark)]/70 leading-relaxed">
              {t("brandDescription")}
            </p>
          </div>

          {/* Categories */}
          <div>
            <h3 className={headingCls}>{t("categories")}</h3>
            <ul className="space-y-2.5">
              {categories.map((cat) => (
                <li key={cat.slug}>
                  <Link href={`${ROUTES.products}?category=${cat.slug}`} className={linkCls}>
                    {getCategoryName(cat, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Care */}
          <div>
            <h3 className={headingCls}>{t("customerCare")}</h3>
            <ul className="space-y-2.5">
              {IS_ONLINE && (
                <li>
                  <Link href={ROUTES.accountOrders} className={linkCls}>
                    {t("trackOrder")}
                  </Link>
                </li>
              )}
              {IS_ONLINE && (
                <li>
                  <Link href={ROUTES.cart} className={linkCls}>
                    {t("shoppingBag")}
                  </Link>
                </li>
              )}
              <li>
                <Link href={ROUTES.wishlist} className={linkCls}>
                  {t("wishlist")}
                </Link>
              </li>
              <li>
                <Link href={ROUTES.about} className={linkCls}>
                  {t("aboutUs")}
                </Link>
              </li>
              <li>
                <FeedbackDialog>
                  <button className={linkCls}>{t("feedback")}</button>
                </FeedbackDialog>
              </li>
              <li>
                <Link href={ROUTES.termsAndConditions} className={linkCls}>
                  {t("termsAndConditions")}
                </Link>
              </li>
              <li>
                <Link href={ROUTES.privacyPolicy} className={linkCls}>
                  {t("privacyPolicy")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className={headingCls}>{t("myAccount")}</h3>
            <ul className="space-y-2.5">
              <li>
                <Link href={ROUTES.account} className={linkCls}>
                  {t("profile")}
                </Link>
              </li>
              {IS_ONLINE && (
                <li>
                  <Link href={ROUTES.accountAddresses} className={linkCls}>
                    {t("addresses")}
                  </Link>
                </li>
              )}
              <li>
                <Link
                  href={isLoggedIn ? "#" : (pathname === "/" ? ROUTES.login : `${ROUTES.login}?redirect=${encodeURIComponent(pathname)}`)}
                  onClick={isLoggedIn ? (e: React.MouseEvent) => { e.preventDefault(); handleSignOut(); } : undefined}
                  className={linkCls}
                >
                  {isLoggedIn ? tCommon("nav.signOut") : tCommon("nav.signIn")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Visit Our Store */}
          <div>
            <h3 className={headingCls}>{t("visitOurStore")}</h3>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2 text-sm text-[var(--text-on-dark)]/75">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gold-300" />
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
                <li className="flex items-center gap-2 text-sm text-[var(--text-on-dark)]/75">
                  <Phone className="h-4 w-4 shrink-0 text-gold-300" />
                  <a href={`tel:${BUSINESS_INFO.phone}`} className="hover:text-gold-300 transition-colors">
                    {BUSINESS_INFO.phone}
                  </a>
                </li>
              )}
              {BUSINESS_INFO.email && (
                <li className="flex items-center gap-2 text-sm text-[var(--text-on-dark)]/75">
                  <Mail className="h-4 w-4 shrink-0 text-gold-300" />
                  <a href={`mailto:${BUSINESS_INFO.email}`} className="hover:text-gold-300 transition-colors">
                    {BUSINESS_INFO.email}
                  </a>
                </li>
              )}
              {BUSINESS_INFO.whatsapp && (
                <li className="flex items-center gap-2 text-sm text-[var(--text-on-dark)]/75">
                  <MessageCircle className="h-4 w-4 shrink-0 text-gold-300" />
                  <a
                    href={`https://wa.me/91${BUSINESS_INFO.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-gold-300 transition-colors"
                  >
                    {t("whatsapp")}
                  </a>
                </li>
              )}
              <li className="flex items-center gap-2 text-sm text-[var(--text-on-dark)]/75">
                <Clock className="h-4 w-4 shrink-0 text-gold-300" />
                <span>Mon–Sat: {BUSINESS_INFO.hours.weekdays}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-center text-sm gap-3 flex flex-col sm:flex-row sm:justify-between items-center text-[var(--text-on-dark)]/60 tracking-wide">
          <p>&copy; {new Date().getFullYear()} {tCommon("appName")}. {t("allRightsReserved")}</p>
          <a
            href="https://darisi.in"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-[var(--text-on-dark)]/50 hover:text-[var(--text-on-dark)]/80 transition-colors"
          >
            {locale === "en" && t("poweredBy")}
            <Image src="/logos/darisi.svg" alt="DARISI" width={25} height={25} className="rounded-lg" />
            <span className="font-semibold tracking-widest uppercase">DARISI</span>
            {locale !== "en" && <span>{t("poweredBy")}</span>}
          </a>
        </div>
      </div>
    </footer>
  );
}
