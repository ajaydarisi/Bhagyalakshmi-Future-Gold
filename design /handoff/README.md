# BFG Redesign — Developer Handoff

Design → production handoff for **Bhagyalakshmi Future Gold** (Next.js App Router · Supabase · Razorpay · Capacitor).

## Contents
| File | Purpose |
|---|---|
| `DESIGN_SYNC.md` | **Start here.** Instruction file for Claude Code `/design-sync` — rules, component map, guardrails. |
| `INTEGRATION_GUIDE.md` | Exact 10-step sequence: what to run, in what order, what to verify, what to commit. |
| `component-specs.md` | Per component/screen: layout, props, variants, states, breakpoints → target repo paths. |
| `tokens.css` | Drop-in CSS custom properties + Tailwind v4 `@theme` mapping + font imports. |
| `tokens.json` | Same tokens, structured (for tooling / `tokens.json` consumers). |

## Quick start
```bash
cp -r ./design/handoff <your-repo>/design/handoff
cd <your-repo>
/design-sync ./design/handoff/DESIGN_SYNC.md
```
Then follow `INTEGRATION_GUIDE.md` step by step (tokens → primitives → layout → screens → verify).

## Scope
This is a **presentation/UX sync**, not a backend change. It re-skins screens and adds the missing UI (checkout steps, account profile/delete, admin CRUD forms, feedback, assistant) on top of your **existing** data, auth, payments, RLS, i18n, and routes. The golden rules in `DESIGN_SYNC.md §1` are non-negotiable.

Visual reference of record: the live prototypes in the design system (`ui_kits/{storefront,auth,account,admin}`).
