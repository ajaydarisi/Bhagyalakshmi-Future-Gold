import { Cormorant_Garamond, Hanken_Grotesk, Marcellus, Noto_Sans_Telugu } from "next/font/google";
import Script from "next/script";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { CapacitorInit } from "@/components/shared/capacitor-init";
import "./globals.css";

const isE2ETestMode = process.env.NEXT_PUBLIC_E2E_TEST_MODE === "1";

const marcellus = Marcellus({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
});

const cormorant = Cormorant_Garamond({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const notoSansTelugu = Noto_Sans_Telugu({
  variable: "--font-telugu",
  subsets: ["telugu"],
  display: "swap",
  preload: false,
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body
        className={`${marcellus.variable} ${cormorant.variable} ${hankenGrotesk.variable} ${notoSansTelugu.variable} antialiased`}
      >
        {!isE2ETestMode && (
          <>
            <Script
              src="https://www.googletagmanager.com/gtag/js?id=G-NKL5JQS5W6"
              strategy="lazyOnload"
            />
            <Script id="google-analytics" strategy="lazyOnload">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', 'G-NKL5JQS5W6');
              `}
            </Script>
            <Script id="sw-register" strategy="lazyOnload">
              {`
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.register('/sw.js');
                }
              `}
            </Script>
          </>
        )}
        <CapacitorInit />
        {children}
        {!isE2ETestMode && <SpeedInsights />}
      </body>
    </html>
  );
}
