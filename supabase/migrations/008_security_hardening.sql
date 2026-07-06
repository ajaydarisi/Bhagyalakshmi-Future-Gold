-- 008_security_hardening.sql
-- Closes several authorization gaps. Safe to run on existing deployments.

-- ---------------------------------------------------------------------------
-- 1. Prevent privilege escalation via the profiles table.
--    RLS does not restrict columns, so the "Users can update own profile"
--    policy previously let any authenticated user set their own role to
--    'admin'. Use column-level privileges instead: clients may only update
--    non-sensitive profile fields. The service_role key (used by admin
--    server actions) is unaffected and can still manage roles.
-- ---------------------------------------------------------------------------
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone, avatar_url, updated_at)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Stop leaking every active coupon code to anonymous visitors.
--    Coupon validation now runs server-side via the service-role client,
--    so the public SELECT policy is no longer needed.
-- ---------------------------------------------------------------------------
drop policy if exists "Active coupons are publicly readable" on public.coupons;

-- ---------------------------------------------------------------------------
-- 3. Device tokens are only ever inserted by the server (service-role) via
--    the /api/notifications/register-token route. Remove the open insert
--    policy so clients can't write arbitrary token rows directly.
-- ---------------------------------------------------------------------------
drop policy if exists "Anyone can insert device tokens" on public.device_tokens;
</content>
