import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
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
  images: {
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
