import { ShopImage } from "@/components/shared/shop-image";
import { Button } from "@/components/ui/button";
import {
  BRAND_STORY,
  BUSINESS_INFO,
  ROUTES,
  SHOP_IMAGES,
} from "@/lib/constants";
import {
  Clock,
  Gem,
  Mail,
  MapPin,
  Phone,
  Shield,
  Star,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us",
  description: BRAND_STORY.short,
};

export default function AboutPage() {
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

  console.log(BUSINESS_INFO.proprietor.name, "BUSINESS_INFO.proprietor.name")

  return (
    <div>
      {/* Hero Banner */}
      <section className="bg-accent/30 py-20">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
            About Us
          </p>
          <h1 className="text-3xl md:text-5xl leading-tight max-w-2xl mx-auto">
            {BRAND_STORY.tagline}
          </h1>
          <p className="mt-4 text-muted-foreground font-sans max-w-lg mx-auto">
            {BRAND_STORY.mission}
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Our Story
            </p>
            <h2 className="text-3xl md:text-4xl leading-snug">
              Rooted in Chirala,
              <br />
              Built on Trust
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-md font-sans">
              {BRAND_STORY.short}
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-md font-sans">
              For years, customers in Chirala and across Bapatla district have
              trusted us for quality fashion jewellery. Now, we&apos;re bringing
              that same trust and quality to you online — so you can shop our
              curated collection from anywhere.
            </p>
            <Button variant="outline" className="mt-6" asChild>
              <Link href={ROUTES.products}>Shop Collection</Link>
            </Button>
          </div>
          <div className="relative aspect-4/5 overflow-hidden bg-muted">
            <ShopImage
              src={SHOP_IMAGES.storefront}
              alt="Bhagyalakshmi Future Gold store in Chirala"
            />
          </div>
        </div>
      </section>

      {/* Our Sourcing */}
      <section className="container mx-auto px-4 pb-20">
        <div className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Where It Comes From
          </p>
          <h2 className="text-3xl md:text-4xl">Our Sourcing</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {BRAND_STORY.sourcing.map((source) => (
            <div
              key={source.title}
              className="border border-border bg-card p-8 text-center"
            >
              {source.title === "Mumbai Dealers" ? (
                <Star className="h-6 w-6 mx-auto mb-4 text-primary" />
              ) : (
                <Gem className="h-6 w-6 mx-auto mb-4 text-primary" />
              )}
              <h3 className="text-sm uppercase tracking-[0.15em] font-medium mb-3">
                {source.title}
              </h3>
              <p className="text-sm text-muted-foreground font-sans leading-relaxed">
                {source.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Quality & Warranty */}
      <section className="bg-accent/30 py-20">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <Shield className="h-8 w-8 mx-auto mb-4 text-primary" />
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Our Promise
          </p>
          <h2 className="text-3xl md:text-4xl mb-6">
            Quality-Checked &amp; Warranty Backed
          </h2>
          <p className="text-muted-foreground leading-relaxed font-sans">
            {BRAND_STORY.qualityProcess}
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed font-sans">
            {BRAND_STORY.warranty}
          </p>
        </div>
      </section>

      {/* Shop Gallery */}
      <section className="container mx-auto px-4 py-20">
        <div className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Our Space
          </p>
          <h2 className="text-3xl md:text-4xl">Visit Our Shop</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            { src: SHOP_IMAGES.storefront, alt: "Bhagyalakshmi Future Gold storefront" },
            { src: SHOP_IMAGES.interior, alt: "Inside Bhagyalakshmi Future Gold shop" },
            {
              src: SHOP_IMAGES.display,
              alt: "Jewellery display at Bhagyalakshmi Future Gold",
            },
          ].map((img) => (
            <div
              key={img.src}
              className="relative aspect-4/3 overflow-hidden bg-muted"
            >
              <ShopImage src={img.src} alt={img.alt} />
            </div>
          ))}
        </div>
      </section>

      {/* Visit Us */}
      <section className="border-t">
        <div className="container mx-auto px-4 py-20">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                Find Us
              </p>
              <h2 className="text-3xl md:text-4xl mb-8">Visit Our Store</h2>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium mb-1">Address</p>
                    <p className="text-sm text-muted-foreground font-sans">
                      {formattedAddress}
                    </p>
                  </div>
                </div>

                {BUSINESS_INFO.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium mb-1">Phone</p>
                      <a
                        href={`tel:${BUSINESS_INFO.phone}`}
                        className="text-sm text-muted-foreground font-sans hover:text-primary transition-colors"
                      >
                        {BUSINESS_INFO.phone}
                      </a>
                    </div>
                  </div>
                )}

                {BUSINESS_INFO.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium mb-1">Email</p>
                      <a
                        href={`mailto:${BUSINESS_INFO.email}`}
                        className="text-sm text-muted-foreground font-sans hover:text-primary transition-colors"
                      >
                        {BUSINESS_INFO.email}
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium mb-1">Business Hours</p>
                    <p className="text-sm text-muted-foreground font-sans">
                      Mon – Sat: {BUSINESS_INFO.hours.weekdays}
                    </p>
                    <p className="text-sm text-muted-foreground font-sans">
                      Sunday: {BUSINESS_INFO.hours.sunday}
                    </p>
                  </div>
                </div>
              </div>

              {BUSINESS_INFO.map.linkUrl && (
                <Button variant="outline" className="mt-8" asChild>
                  <a
                    href={BUSINESS_INFO.map.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    Get Directions
                  </a>
                </Button>
              )}
            </div>

            <div className="relative aspect-square overflow-hidden bg-muted">
              {BUSINESS_INFO.map.embedUrl ? (
                <iframe
                  src={BUSINESS_INFO.map.embedUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Bhagyalakshmi Future Gold location on Google Maps"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MapPin className="h-8 w-8 mb-2" />
                  <span className="text-sm font-sans">
                    Chirala, Bapatla District
                  </span>
                  <span className="text-xs font-sans mt-1">
                    Andhra Pradesh, India
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Proprietor */}
          {BUSINESS_INFO.proprietor.name && (
            <div className="mt-16 pt-12 border-t text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                {BUSINESS_INFO.proprietor.title}
              </p>
              <p className="text-xl">{BUSINESS_INFO.proprietor.name}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
