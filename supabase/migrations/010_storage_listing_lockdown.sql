-- 010_storage_listing_lockdown.sql
-- Removes the broad public SELECT policies on storage.objects for the public
-- buckets. These only enabled anonymous *listing* (enumeration) of every file;
-- both buckets are public=true, so object/APK URLs continue to serve via the
-- /storage/v1/object/public/ endpoint, which does not consult RLS.
-- Safe to run on existing deployments.

drop policy if exists "Public read access for product images" on storage.objects;
drop policy if exists "Allow public read access" on storage.objects;
</content>
