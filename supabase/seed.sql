-- Bhagyalakshmi Future Gold Commerce Seed Data
-- Run this after schema.sql

-- Categories
insert into public.categories (name, slug, description, sort_order) values
  ('Necklaces', 'necklaces', 'Elegant necklaces and pendants for every occasion', 1),
  ('Earrings', 'earrings', 'Statement earrings, studs, and hoops', 2),
  ('Bracelets', 'bracelets', 'Beautiful bracelets and bangles', 3),
  ('Rings', 'rings', 'Stunning rings for everyday wear and special occasions', 4),
  ('Jewellery Sets', 'jewellery-sets', 'Complete jewellery sets for a coordinated look', 5);

-- Products
insert into public.products (name, slug, description, price, discount_price, category_id, stock, material, tags, images, is_active, featured) values
  (
    'Golden Bloom Necklace',
    'golden-bloom-necklace',
    'A stunning gold-plated necklace featuring delicate floral designs. Perfect for both casual and formal occasions.',
    1299, 999,
    (select id from public.categories where slug = 'necklaces'),
    50, 'Gold Plated',
    array['Trending', 'Best Seller'],
    array['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600'],
    true, true
  ),
  (
    'Pearl Drop Earrings',
    'pearl-drop-earrings',
    'Classic pearl drop earrings with a modern twist. These lightweight earrings add elegance to any outfit.',
    799, null,
    (select id from public.categories where slug = 'earrings'),
    75, 'Pearl',
    array['New', 'Best Seller'],
    array['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600'],
    true, true
  ),
  (
    'Silver Charm Bracelet',
    'silver-charm-bracelet',
    'A beautiful sterling silver charm bracelet with customizable charms. Makes a perfect gift.',
    1499, 1199,
    (select id from public.categories where slug = 'bracelets'),
    30, 'Silver',
    array['Trending'],
    array['https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600'],
    true, true
  ),
  (
    'Crystal Rose Ring',
    'crystal-rose-ring',
    'An exquisite rose gold ring featuring sparkling crystals. A statement piece for special occasions.',
    899, 699,
    (select id from public.categories where slug = 'rings'),
    40, 'Rose Gold',
    array['Sale', 'Trending'],
    array['https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600'],
    true, true
  ),
  (
    'Royal Elegance Set',
    'royal-elegance-set',
    'A complete jewellery set including necklace, earrings, and bracelet. Gold-plated with crystal accents.',
    3499, 2799,
    (select id from public.categories where slug = 'jewellery-sets'),
    20, 'Gold Plated',
    array['Best Seller', 'Limited Edition'],
    array['https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=600'],
    true, true
  ),
  (
    'Minimalist Chain Necklace',
    'minimalist-chain-necklace',
    'A delicate and minimal gold chain necklace. Perfect for layering or wearing alone.',
    599, null,
    (select id from public.categories where slug = 'necklaces'),
    100, 'Gold Plated',
    array['New'],
    array['https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=600'],
    true, false
  ),
  (
    'Bohemian Beaded Earrings',
    'bohemian-beaded-earrings',
    'Colorful handcrafted beaded earrings with a bohemian flair. Lightweight and comfortable.',
    449, 349,
    (select id from public.categories where slug = 'earrings'),
    60, 'Beads',
    array['Sale'],
    array['https://images.unsplash.com/photo-1630019852942-f89202989a59?w=600'],
    true, false
  ),
  (
    'Stainless Steel Cuff',
    'stainless-steel-cuff',
    'A bold and modern stainless steel cuff bracelet. Adjustable fit for comfort.',
    999, null,
    (select id from public.categories where slug = 'bracelets'),
    45, 'Stainless Steel',
    array['New'],
    array['https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600'],
    true, false
  ),
  (
    'Vintage Pearl Ring',
    'vintage-pearl-ring',
    'A vintage-inspired ring featuring a single pearl on a brass band. Timeless elegance.',
    649, null,
    (select id from public.categories where slug = 'rings'),
    55, 'Brass',
    array['Trending'],
    array['https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=600'],
    true, false
  ),
  (
    'Crystal Teardrop Necklace',
    'crystal-teardrop-necklace',
    'A beautiful crystal teardrop pendant on a silver chain. Catches light beautifully.',
    1099, 899,
    (select id from public.categories where slug = 'necklaces'),
    35, 'Crystal',
    array['Best Seller'],
    array['https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=600'],
    true, false
  ),
  (
    'Gold Hoop Earrings',
    'gold-hoop-earrings',
    'Classic gold-plated hoop earrings in a medium size. A wardrobe essential.',
    699, null,
    (select id from public.categories where slug = 'earrings'),
    80, 'Gold Plated',
    array['Best Seller'],
    array['https://images.unsplash.com/photo-1629224316810-9d8805b95e76?w=600'],
    true, false
  ),
  (
    'Moonstone Silver Ring',
    'moonstone-silver-ring',
    'A mesmerizing moonstone set in a sterling silver band. Each stone is unique.',
    1199, 999,
    (select id from public.categories where slug = 'rings'),
    25, 'Silver',
    array['Limited Edition'],
    array['https://images.unsplash.com/photo-1608042314453-ae338d80c427?w=600'],
    true, false
  );

-- Sample Coupons
insert into public.coupons (code, description, discount_type, discount_value, min_order_amount, max_uses, is_active) values
  ('WELCOME10', 'Welcome discount - 10% off your first order', 'percentage', 10, 500, null, true),
  ('FLAT200', 'Flat Rs.200 off on orders above Rs.1500', 'fixed', 200, 1500, 100, true),
  ('Bhagyalakshmi Future Gold20', 'Special 20% discount', 'percentage', 20, 1000, 50, true);
