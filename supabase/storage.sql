-- Supabase Storage: Product Images Bucket
-- Run this in your Supabase SQL Editor

-- 1. Create the storage bucket for product images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true);

-- 2. Allow anyone to view product images (public bucket)
create policy "Public read access for product images"
on storage.objects for select
using (bucket_id = 'product-images');

-- 3. Allow authenticated users to upload product images
create policy "Authenticated users can upload product images"
on storage.objects for insert
with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

-- 4. Allow authenticated users to update product images
create policy "Authenticated users can update product images"
on storage.objects for update
using (bucket_id = 'product-images' and auth.role() = 'authenticated');

-- 5. Allow authenticated users to delete product images
create policy "Authenticated users can delete product images"
on storage.objects for delete
using (bucket_id = 'product-images' and auth.role() = 'authenticated');
