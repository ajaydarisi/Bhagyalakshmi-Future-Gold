import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/i18n/routing";
import { SetHtmlLang } from "@/components/shared/set-html-lang";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";
import type { Metadata, Viewport } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://bfg.darisi.in";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#b8860b",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${APP_NAME}`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  authors: [{ name: "Ajay Darisi" }],
  creator: "Ajay Darisi",
  publisher: APP_NAME,
  keywords: [
    "fashion jewellery",
    "fashion jewellery Chirala",
    "jewellery shop Chirala",
    "jewellery Bapatla district",
    "jewellery Andhra Pradesh",
    "quality checked jewellery",
    "Bhagyalakshmi Future Gold Chirala",
    "necklaces",
    "earrings",
    "bracelets",
    "rings",
    "jewellery sets",
    "gold plated jewellery",
    "rose gold jewellery",
    "online jewellery store India",
  ],
  alternates: {
    canonical: SITE_URL,
    languages: {
      en: SITE_URL,
      te: `${SITE_URL}/te`,
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  openGraph: {
    title: `${APP_NAME}`,
    description: APP_DESCRIPTION,
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: APP_NAME,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — Quality-Checked Fashion Jewellery`,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME}`,
    description: APP_DESCRIPTION,
    images: ["/og-image.png"],
  },
  manifest: "/manifest.webmanifest",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <SetHtmlLang locale={locale} />
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster position="bottom-right" />
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
