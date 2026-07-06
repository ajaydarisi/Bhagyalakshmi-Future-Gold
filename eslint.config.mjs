import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored design-system reference export (own runtime/bundle — not app code).
    "bfg-design-system/**",
    // Design handoff prototype (standalone JSX mockups — not app code).
    "design_handoff_mobile_storefront/**",
  ]),
]);

export default eslintConfig;
