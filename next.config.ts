import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // dev-only badge; default bottom-left collides with the voice widget
  devIndicators: { position: "top-left" },
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
    inlineCss: true,
    optimizePackageImports: ["lucide-react", "recharts", "cmdk"],
  },
  turbopack: {
    resolveAlias: {
      // Our browserslist targets modern browsers only (Chrome 120+, Safari 17+)
      // that natively support all APIs in Next.js's polyfill-module.js.
      // Replace the polyfill module with an empty stub to save ~14 KiB.
      "next/dist/build/polyfills/polyfill-module":
        "./src/lib/empty-polyfill.js",
      "next/dist/build/polyfills/polyfill-module.js":
        "./src/lib/empty-polyfill.js",
      "../build/polyfills/polyfill-module":
        "./src/lib/empty-polyfill.js",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
  images: {
    unoptimized: process.env.NODE_ENV === "development",
    minimumCacheTTL: 2592000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
