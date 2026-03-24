import { BUSINESS_INFO } from "@/lib/constants";
import { Mail, Phone, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return {
    title: t("title"),
  };
}

export default async function TermsAndConditionsPage() {
  const t = await getTranslations("legal.terms");
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

  const sections = [
    "useOfWebsite",
    "productsAndPricing",
    "ordersAndPayments",
    "shippingAndDelivery",
    "returnsAndExchanges",
    "rentalTerms",
    "intellectualProperty",
    "limitationOfLiability",
    "governingLaw",
  ] as const;

  return (
    <div>
      {/* Hero */}
      <section className="bg-accent/30 py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl leading-tight max-w-2xl mx-auto">
            {t("title")}
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
          {sections.map((section, index) => (
            <div key={section} id={section} className="scroll-mt-24">
              <h2 className="text-xl md:text-2xl mb-3">
                {index + 1}. {t(`${section}.title`)}
              </h2>
              <p className="text-muted-foreground leading-relaxed font-sans">
                {t(`${section}.content`)}
              </p>
            </div>
          ))}

          {/* Contact */}
          <div id="contact" className="scroll-mt-24">
            <h2 className="text-xl md:text-2xl mb-3">
              {sections.length + 1}. {t("contact.title")}
            </h2>
            <p className="text-muted-foreground leading-relaxed font-sans mb-4">
              {t("contact.content")}
            </p>
            <div className="space-y-3">
              {BUSINESS_INFO.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-sans">
                  <Mail className="h-4 w-4 shrink-0 text-primary" />
                  <span className="font-medium mr-1">{t("contact.emailLabel")}:</span>
                  <a
                    href={`mailto:${BUSINESS_INFO.email}`}
                    className="hover:text-primary transition-colors"
                  >
                    {BUSINESS_INFO.email}
                  </a>
                </div>
              )}
              {BUSINESS_INFO.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-sans">
                  <Phone className="h-4 w-4 shrink-0 text-primary" />
                  <span className="font-medium mr-1">{t("contact.phoneLabel")}:</span>
                  <a
                    href={`tel:${BUSINESS_INFO.phone}`}
                    className="hover:text-primary transition-colors"
                  >
                    {BUSINESS_INFO.phone}
                  </a>
                </div>
              )}
              <div className="flex items-start gap-2 text-sm text-muted-foreground font-sans">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
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
