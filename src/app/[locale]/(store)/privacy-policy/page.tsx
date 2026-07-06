import { BUSINESS_INFO } from "@/lib/constants";
import { Mail, Phone, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return {
    title: t("title"),
  };
}

export default async function PrivacyPolicyPage() {
  const t = await getTranslations("legal.privacy");
  const address = BUSINESS_INFO.address;
  const formattedAddress = [
    address.street,
    address.city,
    `${address.district} Dist.`,
    address.state,
    address.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  const listSections = [
    {
      key: "informationWeCollect",
      items: ["account", "google", "shipping", "order", "usage"],
    },
    {
      key: "howWeUse",
      items: ["orders", "account", "communicate", "improve", "security"],
    },
  ] as const;

  const textSections = [
    "googleAuth",
    "paymentInfo",
    "cookies",
    "dataSecurity",
  ] as const;

  const thirdPartyItems = ["supabase", "razorpay", "google", "vercel"] as const;

  const rightItems = ["access", "update", "delete", "opt-out"] as const;

  return (
    <div>
      {/* Hero */}
      <section className="bg-[var(--bg-page-warm)] py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-display text-4xl md:text-5xl leading-tight max-w-2xl mx-auto">
            <span className="bfg-foil">{t("title")}</span>
          </h1>
          <p className="mt-4 text-sm text-muted-foreground font-sans">
            {t("lastUpdated")}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 py-16 max-w-3xl">
        <p className="text-muted-foreground leading-relaxed font-sans mb-12">
          {t("intro")}
        </p>

        <div className="space-y-10">
          {/* Sections with bullet lists */}
          {listSections.map((section, index) => (
            <div key={section.key} id={section.key} className="scroll-mt-24">
              <h2 className="text-xl md:text-2xl mb-3">
                {index + 1}. {t(`${section.key}.title`)}
              </h2>
              <p className="text-muted-foreground leading-relaxed font-sans mb-3">
                {t(`${section.key}.content`)}
              </p>
              <ul className="list-disc pl-6 space-y-2">
                {section.items.map((item) => (
                  <li
                    key={item}
                    className="text-muted-foreground leading-relaxed font-sans"
                  >
                    {t(`${section.key}.items.${item}`)}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Plain text sections */}
          {textSections.map((section, index) => (
            <div key={section} id={section} className="scroll-mt-24">
              <h2 className="text-xl md:text-2xl mb-3">
                {listSections.length + index + 1}. {t(`${section}.title`)}
              </h2>
              <p className="text-muted-foreground leading-relaxed font-sans">
                {t(`${section}.content`)}
              </p>
            </div>
          ))}

          {/* Third-party services */}
          <div id="thirdParty" className="scroll-mt-24">
            <h2 className="text-xl md:text-2xl mb-3">
              {listSections.length + textSections.length + 1}. {t("thirdParty.title")}
            </h2>
            <p className="text-muted-foreground leading-relaxed font-sans mb-3">
              {t("thirdParty.content")}
            </p>
            <ul className="list-disc pl-6 space-y-2">
              {thirdPartyItems.map((item) => (
                <li
                  key={item}
                  className="text-muted-foreground leading-relaxed font-sans"
                >
                  {t(`thirdParty.items.${item}`)}
                </li>
              ))}
            </ul>
          </div>

          {/* Data retention */}
          <div id="dataRetention" className="scroll-mt-24">
            <h2 className="text-xl md:text-2xl mb-3">
              {listSections.length + textSections.length + 2}. {t("dataRetention.title")}
            </h2>
            <p className="text-muted-foreground leading-relaxed font-sans">
              {t("dataRetention.content")}
            </p>
          </div>

          {/* Children's privacy */}
          <div id="childrensPrivacy" className="scroll-mt-24">
            <h2 className="text-xl md:text-2xl mb-3">
              {listSections.length + textSections.length + 3}. {t("childrensPrivacy.title")}
            </h2>
            <p className="text-muted-foreground leading-relaxed font-sans">
              {t("childrensPrivacy.content")}
            </p>
          </div>

          {/* Your rights */}
          <div id="yourRights" className="scroll-mt-24">
            <h2 className="text-xl md:text-2xl mb-3">
              {listSections.length + textSections.length + 4}. {t("yourRights.title")}
            </h2>
            <p className="text-muted-foreground leading-relaxed font-sans mb-3">
              {t("yourRights.content")}
            </p>
            <ul className="list-disc pl-6 space-y-2">
              {rightItems.map((item) => (
                <li
                  key={item}
                  className="text-muted-foreground leading-relaxed font-sans"
                >
                  {t(`yourRights.items.${item}`)}
                </li>
              ))}
            </ul>
          </div>

          {/* Changes */}
          <div id="changes" className="scroll-mt-24">
            <h2 className="text-xl md:text-2xl mb-3">
              {listSections.length + textSections.length + 5}. {t("changes.title")}
            </h2>
            <p className="text-muted-foreground leading-relaxed font-sans">
              {t("changes.content")}
            </p>
          </div>

          {/* Contact */}
          <div id="contact" className="scroll-mt-24">
            <h2 className="text-xl md:text-2xl mb-3">
              {listSections.length + textSections.length + 6}. {t("contact.title")}
            </h2>
            <p className="text-muted-foreground leading-relaxed font-sans mb-4">
              {t("contact.content")}
            </p>
            <div className="space-y-3">
              {BUSINESS_INFO.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-sans">
                  <Mail className="h-4 w-4 shrink-0 text-gold-500" />
                  <span className="font-medium mr-1">{t("contact.emailLabel")}:</span>
                  <a
                    href={`mailto:${BUSINESS_INFO.email}`}
                    className="hover:text-gold-500 transition-colors"
                  >
                    {BUSINESS_INFO.email}
                  </a>
                </div>
              )}
              {BUSINESS_INFO.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-sans">
                  <Phone className="h-4 w-4 shrink-0 text-gold-500" />
                  <span className="font-medium mr-1">{t("contact.phoneLabel")}:</span>
                  <a
                    href={`tel:${BUSINESS_INFO.phone}`}
                    className="hover:text-gold-500 transition-colors"
                  >
                    {BUSINESS_INFO.phone}
                  </a>
                </div>
              )}
              <div className="flex items-start gap-2 text-sm text-muted-foreground font-sans">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-gold-500" />
                <span>
                  <span className="font-medium mr-1">{t("contact.addressLabel")}:</span>
                  {formattedAddress}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
