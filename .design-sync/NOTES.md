# Design-Sync Notes — Bhagyalakshmi Future Gold

This repo is a **Next.js app**, not a packaged component library. The design
system synced to claude.ai/design is the **shadcn/ui primitives** in
`src/components/ui/` plus the OKLCH design tokens. Branded/page components
(ProductCard, PriceDisplay, etc.) are intentionally excluded — they depend on
app infrastructure (`next-intl`, `next/image`, `@/i18n/routing`, Supabase
providers) and do not render as standalone design-system components.

## Environment setup required before each build

1. **Install deps**: `npm install` (no lockfile-frozen variant needed).
2. **Compile the DS stylesheet** (tokens + all Tailwind v4 utilities + fonts).
   Components ship NO CSS of their own — Tailwind generates utilities at app
   build time from class usage, so the bundle needs a precompiled stylesheet:
   ```sh
   npm install --no-save @tailwindcss/cli
   npx @tailwindcss/cli -i src/app/globals.css -o /tmp/compiled-tw.css --minify
   ```
   Then prepend the brand-font `@import` + `--font-*` var definitions and write
   to `.design-sync/ds-styles.css` (see the header block already in that file).
   Fonts (Marcellus, Playfair Display, DM Sans, Noto Sans Telugu) are loaded by
   `next/font` at runtime in the app, so they can't be scraped — the DS
   stylesheet loads them via a Google Fonts remote `@import` instead
   (`[FONT_REMOTE]`, informational).

## PKG_DIR scaffolding (the tricky part)

The converter expects the package at `node_modules/<pkg>`, which doesn't exist
for an app's own repo. A **self-symlink causes infinite recursion** (hangs the
ts-morph parse) — do NOT `ln -s ../ node_modules/<pkg>`. Instead build a
**non-recursive package dir** with symlinks to the pieces, plus REAL copies of
the config + stylesheet (the security bound rejects a symlinked `.design-sync`
because the stylesheet's realpath escapes the package root):

```sh
PKG=node_modules/bhagyalakshmi-future-gold
rm -rf "$PKG" && mkdir -p "$PKG/.design-sync"
cp package.json "$PKG/package.json"
ln -sfn "$PWD/src" "$PKG/src"
ln -sfn "$PWD/tsconfig.json" "$PKG/tsconfig.json"
cp .design-sync/config.json "$PKG/.design-sync/config.json"
cp .design-sync/ds-styles.css "$PKG/.design-sync/ds-styles.css"   # MUST be a real file
```

Then build in **synth-entry mode** (no `--entry`, so it scans `cfg.srcDir`):
```sh
node .ds-sync/package-build.mjs \
  --config "$PKG/.design-sync/config.json" \
  --node-modules ./node_modules --out ./ds-bundle
node .ds-sync/package-validate.mjs ./ds-bundle    # add browser for render check
```

- `--entry` (barrel) does NOT work for discovery here: this app ships no
  `.d.ts`, so the entry-based path finds 0 components. Synth mode scans
  `src/components/ui` directly and finds them. Keep `cfg.shape: "package"` and
  NO `--entry`.
- Component count is **174** — the shadcn files export compound sub-parts
  (Card → CardHeader/CardContent/…, DropdownMenu → many). All legitimate API.

## Upload status

The DesignSync tool could NOT authorize in the claude.ai/code **web**
environment (`/design-login` needs an interactive terminal). The local
`ds-bundle/` is fully built + structurally validated and is ready to upload.
To complete: run the sync from an interactive Claude Code terminal, or use
Claude Design's "Send to Claude Code Web" to seed the project, then upload.

## Re-sync risks / what's only partial

- **Render check NOT run** — no chromium in this env (`--no-render-check`).
  Previews are not visually verified. Install playwright chromium and
  re-validate before trusting the cards.
- Previews are all **floor cards** (functional, but no authored compositions).
  Authoring the ~33 primary components' previews is the natural next step on a
  re-sync from an interactive terminal where upload works.
- `ds-styles.css` is **generated** (Tailwind compile of `globals.css`); it
  goes stale whenever tokens or utility usage change — recompile per step 2.
- All components land in a single **"general"** group (no docs matched). Add
  `cfg.docsMap` category stubs to group them if desired.
- The `node_modules/bhagyalakshmi-future-gold` scaffold dir is local-only
  (gitignored under node_modules) and must be rebuilt per clone.
