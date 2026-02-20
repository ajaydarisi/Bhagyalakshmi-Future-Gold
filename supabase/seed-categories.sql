-- Bhagyalakshmi Future Gold — Category Hierarchy Seed Data
-- Run this AFTER the schema migration to populate the category tree.
-- Clears existing categories first (cascade will remove product references).

-- ============================================
-- DELETE EXISTING CATEGORIES (optional — comment out if migrating)
-- ============================================
-- DELETE FROM public.categories;

-- ============================================
-- TOP-LEVEL CATEGORIES
-- ============================================

INSERT INTO public.categories (id, parent_id, name, name_telugu, slug, description, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000001', NULL, 'Gold Jewelry', 'బంగారు ఆభరణాలు', 'gold-jewelry', 'Gold and gold-plated jewelry collections', 1),
  ('a0000000-0000-0000-0000-000000000002', NULL, 'Polish / Finish Types', 'పాలిష్ రకాలు', 'polish-finish-types', 'Jewelry categorized by polish and finish', 2),
  ('a0000000-0000-0000-0000-000000000003', NULL, 'Metal Types', 'లోహ రకాలు', 'metal-types', 'Jewelry categorized by metal type', 3),
  ('a0000000-0000-0000-0000-000000000004', NULL, 'Bangles & Bracelets', 'గాజులు & బ్రేస్‌లెట్లు', 'bangles-bracelets', 'Bangles, bracelets, and wrist jewelry', 4),
  ('a0000000-0000-0000-0000-000000000005', NULL, 'Neck Jewelry', 'మెడ ఆభరణాలు', 'neck-jewelry', 'Chokers, chains, and neck ornaments', 5),
  ('a0000000-0000-0000-0000-000000000006', NULL, 'Dance & Traditional Ornaments', 'నాట్య & సంప్రదాయ ఆభరణాలు', 'dance-traditional-ornaments', 'Bharatanatyam and traditional ornaments', 6),
  ('a0000000-0000-0000-0000-000000000007', NULL, 'Leg & Hair Accessories', 'కాలి & జుట్టు ఆభరణాలు', 'leg-hair-accessories', 'Anklets, hair clips, and accessories', 7),
  ('a0000000-0000-0000-0000-000000000008', NULL, 'Marriage Rental Sets', 'పెళ్ళి అద్దె సెట్లు', 'marriage-rental-sets', 'Complete and separate rental sets for marriages', 8);

-- ============================================
-- GOLD JEWELRY — Children
-- ============================================

INSERT INTO public.categories (id, parent_id, name, name_telugu, slug, description, sort_order) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Long Chains', 'పొడవు గొలుసులు', 'long-chains', NULL, 1),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Short Chains', 'చిన్న గొలుసులు', 'short-chains', NULL, 2),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '1 Gram Gold', '1 గ్రాము బంగారం', 'one-gram-gold', '1 Gram gold jewelry', 3),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Necklaces', 'నెక్లెస్‌లు', 'necklaces', NULL, 4),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Harams', 'హారాలు', 'harams', NULL, 5),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Nakshi Gold Harams', 'నక్షి బంగారు హారాలు', 'nakshi-gold-harams', NULL, 6),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Victorian Harams', 'విక్టోరియన్ హారాలు', 'victorian-harams', NULL, 7);

-- 1 Gram Gold — Sub-children
INSERT INTO public.categories (id, parent_id, name, name_telugu, slug, description, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', '1 Gram Gold Chains', '1 గ్రాము బంగారు గొలుసులు', 'one-gram-gold-chains', NULL, 1),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', '1 Gram Gold Earrings', '1 గ్రాము బంగారు చెవి పోగులు', 'one-gram-gold-earrings', NULL, 2),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', '1 Gram Gold Bangles', '1 గ్రాము బంగారు గాజులు', 'one-gram-gold-bangles', NULL, 3);

-- ============================================
-- POLISH / FINISH TYPES — Children
-- ============================================

INSERT INTO public.categories (id, parent_id, name, name_telugu, slug, description, sort_order) VALUES
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000002', 'GJ Polish Harams', 'GJ పాలిష్ హారాలు', 'gj-polish-harams', NULL, 1),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000002', 'GJ Polish Necklaces', 'GJ పాలిష్ నెక్లెస్‌లు', 'gj-polish-necklaces', NULL, 2),
  ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000002', 'Matt Finish Harams', 'మాట్ ఫినిష్ హారాలు', 'matt-finish-harams', NULL, 3),
  ('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000002', 'Matt Finish Necklaces', 'మాట్ ఫినిష్ నెక్లెస్‌లు', 'matt-finish-necklaces', NULL, 4);

-- ============================================
-- METAL TYPES — Children
-- ============================================

INSERT INTO public.categories (id, parent_id, name, name_telugu, slug, description, sort_order) VALUES
  ('b0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000003', 'Pachaloha Bangles', 'పంచలోహ గాజులు', 'pachaloha-bangles', NULL, 1),
  ('b0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000003', 'Pachaloha Rings', 'పంచలోహ ఉంగరాలు', 'pachaloha-rings', NULL, 2);

-- ============================================
-- BANGLES & BRACELETS — Children
-- ============================================

INSERT INTO public.categories (id, parent_id, name, name_telugu, slug, description, sort_order) VALUES
  ('b0000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000004', 'Bracelets', 'బ్రేస్‌లెట్లు', 'bracelets', NULL, 1),
  ('b0000000-0000-0000-0000-000000000031', 'a0000000-0000-0000-0000-000000000004', 'Baby Bangles - Plain', 'బేబీ గాజులు - ప్లెయిన్', 'baby-bangles-plain', NULL, 2),
  ('b0000000-0000-0000-0000-000000000032', 'a0000000-0000-0000-0000-000000000004', 'Baby Bangles - Stone', 'బేబీ గాజులు - రాయి', 'baby-bangles-stone', NULL, 3);

-- ============================================
-- NECK JEWELRY — Children
-- ============================================

INSERT INTO public.categories (id, parent_id, name, name_telugu, slug, description, sort_order) VALUES
  ('b0000000-0000-0000-0000-000000000040', 'a0000000-0000-0000-0000-000000000005', 'Neck Chokers', 'మెడ చోకర్లు', 'neck-chokers', NULL, 1),
  ('b0000000-0000-0000-0000-000000000041', 'a0000000-0000-0000-0000-000000000005', 'Black Chains', 'నల్ల గొలుసులు', 'black-chains', NULL, 2),
  ('b0000000-0000-0000-0000-000000000042', 'a0000000-0000-0000-0000-000000000005', 'Haldi Sets', 'హల్దీ సెట్లు', 'haldi-sets', NULL, 3);

-- ============================================
-- DANCE & TRADITIONAL ORNAMENTS — Children
-- ============================================

INSERT INTO public.categories (id, parent_id, name, name_telugu, slug, description, sort_order) VALUES
  ('b0000000-0000-0000-0000-000000000050', 'a0000000-0000-0000-0000-000000000006', 'Maatilu', 'మాటిలు', 'maatilu', NULL, 1),
  ('b0000000-0000-0000-0000-000000000051', 'a0000000-0000-0000-0000-000000000006', 'Champaswaralu', 'చంపస్వరాలు', 'champaswaralu', NULL, 2),
  ('b0000000-0000-0000-0000-000000000052', 'a0000000-0000-0000-0000-000000000006', 'Jada Billalu', 'జడ బిళ్ళలు', 'jada-billalu', NULL, 3),
  ('b0000000-0000-0000-0000-000000000053', 'a0000000-0000-0000-0000-000000000006', 'Papidi Billalu', 'పాపిడి బిళ్ళలు', 'papidi-billalu', NULL, 4),
  ('b0000000-0000-0000-0000-000000000054', 'a0000000-0000-0000-0000-000000000006', 'Vankilu', 'వంకీలు', 'vankilu', NULL, 5),
  ('b0000000-0000-0000-0000-000000000055', 'a0000000-0000-0000-0000-000000000006', 'Vandranam / Vadranam', 'వడ్డాణం', 'vadranam', NULL, 6),
  ('b0000000-0000-0000-0000-000000000056', 'a0000000-0000-0000-0000-000000000006', 'Studs', 'స్టడ్స్', 'studs', NULL, 7),
  ('b0000000-0000-0000-0000-000000000057', 'a0000000-0000-0000-0000-000000000006', 'Saree Pins', 'చీర పిన్నులు', 'saree-pins', NULL, 8),
  ('b0000000-0000-0000-0000-000000000058', 'a0000000-0000-0000-0000-000000000006', 'Hair Clips', 'హెయిర్ క్లిప్స్', 'hair-clips', NULL, 9),
  ('b0000000-0000-0000-0000-000000000059', 'a0000000-0000-0000-0000-000000000006', 'Venis', 'వేణీలు', 'venis', NULL, 10),
  ('b0000000-0000-0000-0000-00000000005a', 'a0000000-0000-0000-0000-000000000006', 'Hair Extensions', 'హెయిర్ ఎక్స్‌టెన్షన్స్', 'hair-extensions', NULL, 11),
  ('b0000000-0000-0000-0000-00000000005b', 'a0000000-0000-0000-0000-000000000006', 'Bharatanatyam Sets', 'భరతనాట్యం సెట్లు', 'bharatanatyam-sets', NULL, 12),
  ('b0000000-0000-0000-0000-00000000005c', 'a0000000-0000-0000-0000-000000000006', 'God Ornaments', 'దేవుడి ఆభరణాలు', 'god-ornaments', NULL, 13);

-- ============================================
-- LEG & HAIR ACCESSORIES — Children
-- ============================================

INSERT INTO public.categories (id, parent_id, name, name_telugu, slug, description, sort_order) VALUES
  ('b0000000-0000-0000-0000-000000000060', 'a0000000-0000-0000-0000-000000000007', 'Pattilu / Payalu', 'పట్టీలు / పాయలు', 'pattilu-payalu', 'Anklets', 1);

-- ============================================
-- MARRIAGE RENTAL SETS — Children
-- ============================================

INSERT INTO public.categories (id, parent_id, name, name_telugu, slug, description, sort_order) VALUES
  ('b0000000-0000-0000-0000-000000000070', 'a0000000-0000-0000-0000-000000000008', 'Full Rental Marriage Sets', 'పూర్తి అద్దె పెళ్ళి సెట్లు', 'full-rental-marriage-sets', 'Complete marriage sets including chokers, necklace, haram, vadranam, vankilu, papidi billalu, jumki, champaswaralu, maatili, nose rings, and jeda billalu', 1),
  ('b0000000-0000-0000-0000-000000000071', 'a0000000-0000-0000-0000-000000000008', 'Rental Haldi Sets', 'అద్దె హల్దీ సెట్లు', 'rental-haldi-sets', NULL, 2),
  ('b0000000-0000-0000-0000-000000000072', 'a0000000-0000-0000-0000-000000000008', 'Rental Venis', 'అద్దె వేణీలు', 'rental-venis', NULL, 3),
  ('b0000000-0000-0000-0000-000000000073', 'a0000000-0000-0000-0000-000000000008', 'Rental Jeda Billalu', 'అద్దె జడ బిళ్ళలు', 'rental-jeda-billalu', NULL, 4),
  ('b0000000-0000-0000-0000-000000000074', 'a0000000-0000-0000-0000-000000000008', 'Rental Jeda Kuppelu', 'అద్దె జడ కుప్పెలు', 'rental-jeda-kuppelu', NULL, 5),
  ('b0000000-0000-0000-0000-000000000075', 'a0000000-0000-0000-0000-000000000008', 'Groom Hat (Talapaga)', 'పెళ్ళికొడుకు టోపీ (తలపాగ)', 'groom-hat-talapaga', NULL, 6),
  ('b0000000-0000-0000-0000-000000000076', 'a0000000-0000-0000-0000-000000000008', 'Groom Mutyala Harams', 'పెళ్ళికొడుకు ముత్యాల హారాలు', 'groom-mutyala-harams', NULL, 7);
