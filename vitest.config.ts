import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // .tsx so component tests can live here too; they opt into jsdom per file
    // with a `// @vitest-environment jsdom` pragma rather than paying for a DOM
    // in the many pure-logic suites.
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
