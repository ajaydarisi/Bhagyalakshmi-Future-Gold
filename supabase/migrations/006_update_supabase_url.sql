-- Migration: Update all stored URLs from bfg.jiobase.com → kpjjrudqceexszwgymij.supabase.co
-- Run this in Supabase SQL Editor

-- 1. profiles.avatar_url
UPDATE public.profiles
SET avatar_url = REPLACE(avatar_url, 'https://bfg.jiobase.com', 'https://kpjjrudqceexszwgymij.supabase.co')
WHERE avatar_url LIKE '%bfg.jiobase.com%';

-- 2. categories.image_url
UPDATE public.categories
SET image_url = REPLACE(image_url, 'https://bfg.jiobase.com', 'https://kpjjrudqceexszwgymij.supabase.co')
WHERE image_url LIKE '%bfg.jiobase.com%';

-- 3. products.images (text[] array — unnest, replace, re-aggregate)
UPDATE public.products
SET images = (
  SELECT ARRAY_AGG(
    REPLACE(elem, 'https://bfg.jiobase.com', 'https://kpjjrudqceexszwgymij.supabase.co')
  )
  FROM UNNEST(images) AS elem
)
WHERE EXISTS (
  SELECT 1 FROM UNNEST(images) AS elem WHERE elem LIKE '%bfg.jiobase.com%'
);

-- 4. order_items.product_image
UPDATE public.order_items
SET product_image = REPLACE(product_image, 'https://bfg.jiobase.com', 'https://kpjjrudqceexszwgymij.supabase.co')
WHERE product_image LIKE '%bfg.jiobase.com%';

-- 5. notifications.image_url
UPDATE public.notifications
SET image_url = REPLACE(image_url, 'https://bfg.jiobase.com', 'https://kpjjrudqceexszwgymij.supabase.co')
WHERE image_url LIKE '%bfg.jiobase.com%';
