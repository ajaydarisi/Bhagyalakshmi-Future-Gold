-- Security fix: prevent privilege escalation via profiles.role
--
-- The previous UPDATE policy ("Users can update own profile") gated only the
-- row (auth.uid() = id) with no WITH CHECK and no column restriction. Because
-- the storefront updates profiles directly with the anon/authenticated client,
-- any logged-in user could set their own role to 'admin' via the public API and
-- gain full admin access.
--
-- The replacement pins `role` to its current value for the calling user in the
-- WITH CHECK clause, so a regular user can still edit their own name/phone but
-- cannot change their role. service_role and postgres bypass RLS, so admin-
-- driven role assignment (via the service-role client) and migrations are
-- unaffected.

drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile" on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );
