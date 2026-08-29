# T1-10 — `sort=` is silently dropped whenever `q=` is present, so "cheapest" navigation lies

| | |
|---|---|
| **Severity** | medium |
| **Confidence** | `verified` |
| **Effort** | M |
| **Category** | correctness |
| **File** | `src/app/[locale]/(store)/products/page.tsx:370-400` |
| **Sequencing** | **After T1-1.** T1-1 is what makes valid `q`+`sort` navigations reliably reach this page. |

## Symptom

The customer says "show me the cheapest gold bangles". The assistant builds
`/products?q=gold+bangles&sort=price-asc`, navigates, and the page shows results in **relevance** order.
The cheapest item may be anywhere on the page. The assistant's spoken confirmation said "cheapest", so it
has stated something untrue — worse than not supporting the request.

This also affects ordinary site users who set a sort and then type in the search box.

## Verified root cause

The products page has **two mutually exclusive data paths** and only one of them passes `sort` through.

`src/app/[locale]/(store)/products/page.tsx`, around `:370-400`:

```ts
        type,
        minPrice,
        maxPrice,
        sort,                 // ← path A: sort IS passed
        page: 1,
        locale,
        search,
      });
      products = filteredProducts.slice(0, PRODUCTS_PER_PAGE);
      count = filteredProducts.length;
    } else {
      const response = await searchProducts({
        query: search,
        locale,
        limit: PRODUCTS_PER_PAGE,
        offset: 0,
        filters: {
          categoryIds,
          materials,
          tags,
          type: (type as "sale" | "rental" | "all" | "") || "all",
          minPrice,
          maxPrice,
                              // ← path B: NO sort field at all
        },
      });
```

Path B is the `searchProducts` branch, taken when `search` (from `q`) is present. Its `filters` object
carries `categoryIds`, `materials`, `tags`, `type`, `minPrice`, `maxPrice` — and **no `sort`**. The
parameter is parsed from the URL (`:34` in the `searchParams` type) and then quietly discarded on this path.

The sort implementation itself lives on the non-search path and is real —
`:238-241` and `:271` handle `discount`, `price-asc`, `price-desc` and the default ordering:

```ts
      const isDiscountSort = sort === "discount";
      const isPriceSort = sort === "price-asc" || sort === "price-desc";
      ...
      const asc = sort === "price-asc";
```

Note this sorting is non-trivial: price sorting has to account for sale vs rental pricing and
discount-vs-base price (the `.or(...)` expressions at `:126` and `:225` show the same complexity for price
*filtering*). That is why it cannot simply be appended to the search query — see below.

For the assistant specifically, the manifest happily serializes both together —
`productFiltersNavigation` (`src/lib/assistant-route-manifest.ts`) sets `q` and `sort` independently, and
the byte-compare invariant approves the URL because the URL is perfectly well-formed. The page then honours
one and ignores the other.

## Why this is an M, not an S

`searchProducts` is a **relevance-ranked** search (it goes through the retrieval/FTS path, ultimately
`hybrid_search_products`). "Sort by price" and "rank by relevance" are competing orderings, so there is a
genuine product decision here, not just a missing parameter:

1. **Re-sort the search results in memory.** Fetch the search page, then order it by the effective price.
   Cheap and honest for the current page, but **wrong across pagination** — page 2's cheapest item may be
   cheaper than page 1's, because the search already truncated by relevance. Acceptable only if you also
   fetch a larger candidate set before sorting.
2. **Push the sort into the search query.** Correct, and the right long-term answer, but it means teaching
   the search path the same sale-vs-rental effective-price logic the filter path already has. That logic
   belongs in `src/lib/product-pricing.ts` per CLAUDE.md — check what is already there before writing any
   of it, because duplicating price logic is explicitly against house rules.
3. **Tell the truth instead.** When `q` and `sort` are both present, keep relevance order and have the
   assistant's confirmation say "here are gold bangles" rather than "here are the cheapest gold bangles".

**Recommendation: (3) now, (2) as a scheduled follow-up.** (3) is small, removes the lie immediately, and
does not risk the price logic. (1) is a trap — it looks like a fix and is silently wrong on page 2.

### Implementing (3)

The assistant must not claim an ordering the page will not apply. Two places to touch:

- **Where the navigation is built** — if the resolver is about to emit both `q` and `sort`, drop `sort`
  (the page ignores it anyway, and carrying it in the URL implies it took effect). Find the emitters:
  ```bash
  rg -n "productFiltersNavigation|sort" src/lib/assistant-navigation*.ts src/lib/assistant-route-manifest.ts
  ```
- **Where the confirmation copy is built** — `src/lib/assistant.ts:127` area is where the navigation
  acknowledgement is assembled. The copy must not mention an ordering that was dropped. (This overlaps a
  known gap: the acknowledgement does not name the filters it applied at all. Improving that is a separate
  UX task — do not expand into it here.)

Add a comment at the `searchProducts` call site in `products/page.tsx` recording that `sort` is
deliberately not honoured on this path and pointing at the follow-up, so the next reader does not think it
is an oversight.

### If you choose (2) instead

Then the acceptance criteria become the full matrix below rather than the honesty check, and the price
logic must be reused from `src/lib/product-pricing.ts`, not reimplemented. Budget more than the "M" this
task is sized at.

## Blast radius

- `products/page.tsx` is a plain user-facing page — any change affects **all** site search, not just the
  assistant. That is the reason to prefer the small option.
- `src/components/products/product-sort.tsx` renders the sort control. If sort genuinely does nothing while
  a search is active, the control is lying to ordinary users too. Under option (3), consider disabling it
  (with a tooltip) when `q` is present — that is honest, and it is a two-line change in an existing
  component. Under option (2) it just starts working.
- Do not change `PRODUCTS_PER_PAGE` or the pagination contract.

## Acceptance criteria

Under option (3):
1. "Show me the cheapest gold bangles" → the spoken/typed confirmation does **not** claim price ordering.
2. The URL does not carry a `sort` value that the page will ignore.
3. `/products?sort=price-asc` with no `q` still sorts by price (unchanged).
4. `/products?q=bangles` still returns relevance-ranked results (unchanged).
5. The sort control is not silently inert while presenting itself as active.

Under option (2), add:
6. `/products?q=bangles&sort=price-asc` returns bangles genuinely ordered by effective price, correct
   across at least two pages, and correct for both sale and rental items.

## Tests to add

`tests/unit/assistant-navigation.test.ts`: assert that a "cheapest X" style request does not produce a
navigation whose href contains both `q` and `sort` (option 3), or does and is honoured (option 2). Either
way the test encodes the decision so a future change cannot silently reintroduce the lie.

If option (2): add a data-level test over the search path asserting ordering across a page boundary. That is
the assertion that catches the pagination trap in option (1).

## Verification

```bash
npm run lint && npx tsc --noEmit && npm run test:unit && npm run build
```

Manual matrix, in both locales:

| URL | Expected |
|---|---|
| `/products?sort=price-asc` | price ascending |
| `/products?q=bangles` | relevance |
| `/products?q=bangles&sort=price-asc` | per the chosen option, and the UI must not claim otherwise |
| `/te/products?q=గాజులు&sort=price-asc` | same behaviour under the Telugu locale |

## Rollback

Option (3) is a copy/serialization change — revert cleanly. Option (2) touches the search query; revert the
query change and keep any `product-pricing.ts` additions if other code adopted them.
