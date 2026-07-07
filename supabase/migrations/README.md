# Supabase Migrations

> **The numeric filename prefixes here are _not_ the tracked migration versions.**
> The versions recorded in `supabase_migrations.schema_migrations` on the live
> databases are **timestamps** (created via the Supabase CLI/dashboard), so a
> filename like `012_restore_product_stock.sql` does **not** map 1:1 to a
> tracked version. Read this before adding or reconciling migrations.

## Filename numbering collisions

Prefixes `008`, `009`, and `010` are each used by **two** files that were
authored in different sessions and applied at different times. The files are all
legitimately applied to prod — the duplicate numbers are cosmetic — but the
prefix alone does not tell you the apply order.

| Repo file | Tracked version (prod) | Applied |
|---|---|---|
| `008_security_hardening.sql` | `20260624145853 008_security_hardening` | ✅ |
| `009_security_hardening_followup.sql` | `20260624150947 009_security_hardening_followup` | ✅ |
| `010_storage_listing_lockdown.sql` | `20260624152603 010_storage_listing_lockdown` | ✅ |
| `008_rls_initplan_and_fk_indexes.sql` | `20260701015833 rls_initplan_and_fk_indexes` | ✅ |
| `009_rental_checkout_and_feedback.sql` | `20260702140841 rental_checkout_and_feedback` | ✅ |
| `010_rental_lifecycle_and_availability.sql` | `20260702150830 rental_lifecycle_and_availability` | ✅ |
| `011_security_hardening.sql` | `20260706185919 security_hardening_atomic_rpcs_role_trigger` **+** `20260706190135 pin_prevent_role_change_search_path` | ✅ |
| `012_restore_product_stock.sql` | _(no tracked row — see below)_ | ✅ function live |

Notes:

- **`011`** was applied to prod in two steps: the atomic RPCs + role trigger,
  then a follow-up that pinned `prevent_role_change`'s `search_path` to `''`.
  The repo's `011_security_hardening.sql` already includes that pin inline, so
  the single file represents both tracked versions. Verified live:
  `prevent_role_change` is `SECURITY INVOKER` with `search_path=''`.
- **`012_restore_product_stock.sql`** — the `increment_product_stock(items jsonb)`
  function **is present and hardened in prod** (`SECURITY DEFINER`,
  `search_path=public`, `EXECUTE` granted only to `service_role`/`postgres`), but
  it was applied ad-hoc and has **no matching `schema_migrations` row**.

## Reconciling `012`

Re-applying `012` is safe — it is `create or replace function` + `revoke`, so a
`supabase db push` that re-runs it is idempotent and changes nothing. To silence
it in the migration history instead, record the row once (adjust the timestamp
to the actual apply time if known):

```sql
insert into supabase_migrations.schema_migrations (version, name)
values ('20260706191500', '012_restore_product_stock')
on conflict (version) do nothing;
```

Or, with the CLI: `supabase migration repair --status applied 20260706191500`.

## Adding new migrations

- The next free integer prefix is **`013`**. **Do not reuse a number** — grep the
  directory first.
- Keep each file self-contained and idempotent (`create or replace`,
  `create ... if not exists`, `drop ... if exists`) so re-applying is a no-op.
- After applying to prod, confirm the object exists rather than trusting the
  filename prefix, and make sure a `schema_migrations` row is recorded.
