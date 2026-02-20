-- Bhagyalakshmi Future Gold Commerce Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- PROFILES (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  phone text,
  avatar_url text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ADDRESSES
create table public.addresses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  label text not null default 'Home',
  full_name text not null,
  phone text not null,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'India',
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CATEGORIES
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  parent_id uuid references public.categories(id) on delete cascade,
  name text not null unique,
  name_telugu text,
  slug text not null unique,
  description text,
  image_url text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- PRODUCTS
create table public.products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  name_telugu text,
  slug text not null unique,
  description text,
  price numeric(10,2) not null check (price >= 0),
  discount_price numeric(10,2) check (discount_price >= 0),
  category_id uuid references public.categories(id) on delete set null,
  stock integer not null default 0 check (stock >= 0),
  material text,
  tags text[] default '{}',
  images text[] default '{}',
  is_active boolean default true,
  featured boolean default false,
  is_sale boolean not null default true,
  is_rental boolean not null default false,
  rental_price numeric(10,2) check (rental_price >= 0),
  rental_deposit numeric(10,2) check (rental_deposit >= 0),
  max_rental_days integer check (max_rental_days > 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CART ITEMS (for logged-in users)
create table public.cart_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, product_id)
);

-- WISHLIST
create table public.wishlist_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, product_id)
);

-- COUPONS
create table public.coupons (
  id uuid default uuid_generate_v4() primary key,
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  min_order_amount numeric(10,2) default 0,
  max_uses integer,
  used_count integer default 0,
  is_active boolean default true,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- ORDERS
create table public.orders (
  id uuid default uuid_generate_v4() primary key,
  order_number text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  subtotal numeric(10,2) not null,
  shipping_cost numeric(10,2) default 0,
  discount_amount numeric(10,2) default 0,
  total numeric(10,2) not null,
  coupon_id uuid references public.coupons(id) on delete set null,
  shipping_address jsonb not null,
  billing_address jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ORDER ITEMS
create table public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_image text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  total_price numeric(10,2) not null,
  created_at timestamptz default now()
);

-- PAYMENT TRANSACTIONS
create table public.payment_transactions (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  amount numeric(10,2) not null,
  currency text default 'INR',
  status text not null default 'created'
    check (status in ('created', 'authorized', 'captured', 'failed', 'refunded')),
  method text,
  error_description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- INDEXES
-- ============================================

-- Products
create index idx_products_category on public.products(category_id);
create index idx_products_slug on public.products(slug);
create index idx_products_active on public.products(is_active);
create index idx_products_featured on public.products(featured);
create index idx_products_active_category on public.products(is_active, category_id);
create index idx_products_active_featured on public.products(is_active, featured) where featured = true;
create index idx_products_active_created on public.products(is_active, created_at desc);
create index idx_products_active_price on public.products(is_active, price);
create index idx_products_active_material on public.products(is_active, material) where material is not null;

-- Orders
create index idx_orders_user on public.orders(user_id);
create index idx_orders_status on public.orders(status);
create index idx_orders_user_created on public.orders(user_id, created_at desc);
create index idx_orders_status_created on public.orders(status, created_at);
create index idx_orders_created on public.orders(created_at desc);

-- Order items
create index idx_order_items_order on public.order_items(order_id);
create index idx_order_items_product on public.order_items(product_id);

-- Payment transactions
create index idx_payment_transactions_order on public.payment_transactions(order_id);
create index idx_payment_transactions_razorpay_order on public.payment_transactions(razorpay_order_id);

-- Cart & Wishlist
create index idx_cart_items_user on public.cart_items(user_id);
create index idx_wishlist_user on public.wishlist_items(user_id);

-- Addresses (composite replaces single-column for user_id)
create index idx_addresses_user_default on public.addresses(user_id, is_default desc);

-- Categories
create index idx_categories_sort on public.categories(sort_order);
create index idx_categories_parent on public.categories(parent_id);

-- Products: sale/rental
create index idx_products_rental on public.products(is_rental) where is_rental = true;
create index idx_products_sale on public.products(is_sale) where is_sale = true;

-- Coupons
create index idx_coupons_active on public.coupons(is_active) where is_active = true;

-- Full Text Search on products
alter table public.products add column fts tsvector
  generated always as (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(material, ''))
  ) stored;
create index idx_products_fts on public.products using gin(fts);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.coupons enable row level security;
alter table public.payment_transactions enable row level security;

-- Profiles
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Addresses
create policy "Users manage own addresses" on public.addresses for all using (auth.uid() = user_id);

-- Categories: everyone can read
create policy "Categories are publicly readable" on public.categories for select using (true);

-- Products: everyone can read active products
create policy "Active products are publicly readable" on public.products for select using (is_active = true);

-- Cart items
create policy "Users manage own cart" on public.cart_items for all using (auth.uid() = user_id);

-- Wishlist
create policy "Users manage own wishlist" on public.wishlist_items for all using (auth.uid() = user_id);

-- Orders
create policy "Users can view own orders" on public.orders for select using (auth.uid() = user_id);
create policy "Users can insert own orders" on public.orders for insert with check (auth.uid() = user_id);

-- Order items
create policy "Users can view own order items" on public.order_items for select
  using (exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = auth.uid()));

-- Coupons: everyone can read active coupons
create policy "Active coupons are publicly readable" on public.coupons for select using (is_active = true);

-- Payment transactions
create policy "Users can view own transactions" on public.payment_transactions for select
  using (exists (select 1 from public.orders where orders.id = payment_transactions.order_id and orders.user_id = auth.uid()));

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at();
create trigger update_products_updated_at before update on public.products
  for each row execute procedure public.update_updated_at();
create trigger update_cart_items_updated_at before update on public.cart_items
  for each row execute procedure public.update_updated_at();
create trigger update_orders_updated_at before update on public.orders
  for each row execute procedure public.update_updated_at();
create trigger update_addresses_updated_at before update on public.addresses
  for each row execute procedure public.update_updated_at();
create trigger update_payment_transactions_updated_at before update on public.payment_transactions
  for each row execute procedure public.update_updated_at();
