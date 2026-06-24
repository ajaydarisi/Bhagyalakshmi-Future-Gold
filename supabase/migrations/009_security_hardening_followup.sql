-- 009_security_hardening_followup.sql
-- Addresses Supabase advisor findings surfaced after migration 008.
-- Safe to run on existing deployments.

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on public tables that were exposed via PostgREST.
--    `catalog_retrieval_documents` is only ever accessed through the
--    service-role client (semantic search / indexing) and `health` is an
--    internal heartbeat table, so no policies are required — service_role
--    bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.catalog_retrieval_documents enable row level security;
alter table public.health enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Lock down RPCs that should only run server-side or via triggers.
--    These functions currently carry EXECUTE for PUBLIC + anon + authenticated,
--    so e.g. decrement_product_stock could be called via /rest/v1/rpc to
--    tamper with inventory. service_role keeps its own explicit grant, so the
--    checkout / webhook code paths are unaffected.
-- ---------------------------------------------------------------------------
revoke execute on function public.decrement_product_stock(jsonb)
  from public, anon, authenticated;
revoke execute on function public.hybrid_search_products(
  text, text, integer, integer, uuid[], text[], text[], text, numeric, numeric
) from public, anon, authenticated;
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Pin a stable search_path on all functions (fixes the
--    function_search_path_mutable advisor and prevents search_path hijacking).
-- ---------------------------------------------------------------------------
alter function public.decrement_product_stock(jsonb)
  set search_path = public;
alter function public.hybrid_search_products(
  text, text, integer, integer, uuid[], text[], text[], text, numeric, numeric
) set search_path = public;
alter function public.handle_new_user()
  set search_path = public;
alter function public.update_updated_at()
  set search_path = public;

-- ---------------------------------------------------------------------------
-- 4. (DEFERRED) Public storage buckets still carry broad SELECT policies that
--    allow anonymous *listing* of all files. Both buckets are public=true, so
--    the following drops are safe (object/APK URLs serve via /object/public/
--    regardless of RLS) but were intentionally NOT applied yet pending review.
--    To apply, uncomment and run:
--
-- drop policy if exists "Public read access for product images" on storage.objects;
-- drop policy if exists "Allow public read access" on storage.objects;

</content>
