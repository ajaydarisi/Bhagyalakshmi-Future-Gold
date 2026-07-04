-- Security hardening:
--   1. Block privilege escalation: customers must not be able to set their own
--      profiles.role to 'admin'. RLS lets a user UPDATE their own row and there
--      is no column restriction, so this trigger is the gate. Only the service
--      role (admin actions) may change role.
--   2. Version-control the two money-path RPCs (previously live-only) and make
--      them atomic so concurrent checkouts cannot oversell stock or exceed a
--      coupon's max_uses.
--
-- NOTE: decrement_product_stock / increment_coupon_usage already exist in the
-- production database. Confirm the live argument types match these (jsonb
-- `items`, uuid `coupon_id`) before applying, otherwise this creates overloads
-- instead of replacing.

-- ---------------------------------------------------------------------------
-- 1. Prevent role escalation
-- ---------------------------------------------------------------------------

-- SECURITY INVOKER (default) so current_user reflects the actual caller role
-- that PostgREST set (authenticated/anon), not the function owner.
create or replace function public.prevent_role_change()
returns trigger as $$
begin
  if new.role is distinct from old.role
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'Not allowed to change role';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- ---------------------------------------------------------------------------
-- 2. Atomic stock decrement (never drives stock negative)
-- ---------------------------------------------------------------------------

-- `WHERE stock >= quantity` makes each decrement atomic: a losing concurrent
-- checkout no-ops instead of going negative. Residual: the losing order is
-- still marked paid without a decrement (single-unit oversell) — a full fix
-- needs stock reservation at order creation, tracked separately.
create or replace function public.decrement_product_stock(items jsonb)
returns void as $$
declare
  item jsonb;
begin
  for item in select * from jsonb_array_elements(items)
  loop
    update public.products
    set stock = stock - (item->>'quantity')::int
    where id = (item->>'product_id')::uuid
      and stock >= (item->>'quantity')::int;
  end loop;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- 3. Atomic coupon usage increment (enforces max_uses at the DB)
-- ---------------------------------------------------------------------------

create or replace function public.increment_coupon_usage(coupon_id uuid)
returns void as $$
begin
  update public.coupons
  set used_count = used_count + 1
  where id = coupon_id
    and (max_uses is null or used_count < max_uses);
end;
$$ language plpgsql security definer set search_path = public;

-- These run with definer privileges and must only be reachable through the
-- service-role client, never called directly by a customer.
revoke all on function public.decrement_product_stock(jsonb) from public, anon, authenticated;
revoke all on function public.increment_coupon_usage(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Close over-permissive RLS policies (all writes go via the service role)
-- ---------------------------------------------------------------------------

-- Coupon codes and discount values were world-readable via the anon key. The
-- app only ever reads coupons through the service-role client, so drop it.
drop policy if exists "Active coupons are publicly readable" on public.coupons;

-- `with check (true)` let anyone insert a device token bound to any user_id
-- (receive another user's push notifications). Token registration goes through
-- the service-role route, so this policy is unnecessary.
drop policy if exists "Anyone can insert device tokens" on public.device_tokens;
