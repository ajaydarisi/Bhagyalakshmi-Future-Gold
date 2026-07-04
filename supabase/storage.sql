-- Supabase Storage: Product Images Bucket
-- Run this in your Supabase SQL Editor

-- 1. Create the storage bucket for product images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true);

-- 2. Allow anyone to view product images (public bucket)
create policy "Public read access for product images"
on storage.objects for select
using (bucket_id = 'product-images');

-- 3. Only admins may upload product images. Uploads run under the admin's
--    authenticated session (lib/supabase/storage.ts), so gate on profiles.role
--    — a plain 'authenticated' check let any customer overwrite/delete photos.
create policy "Admins can upload product images"
on storage.objects for insert
with check (
  bucket_id = 'product-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 4. Only admins may update product images
create policy "Admins can update product images"
on storage.objects for update
using (
  bucket_id = 'product-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 5. Only admins may delete product images
create policy "Admins can delete product images"
on storage.objects for delete
using (
  bucket_id = 'product-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
