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
  description_telugu text,
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
  rental_discount_price numeric(10,2) check (rental_discount_price >= 0),
  rental_deposit numeric(10,2) check (rental_deposit >= 0),
  max_rental_days integer check (max_rental_days > 0),
  set_number integer check (set_number > 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CART ITEMS (for logged-in users)
create table public.cart_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  quantity integer not null default 1 check (quantity > 0),
  rental_start date,
  rental_end date,
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
  order_type text not null default 'sale'
    check (order_type in ('sale', 'rental', 'mixed')),
  rental_status text
    check (rental_status in ('booked', 'active', 'returned')),
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
  is_rental boolean not null default false,
  rental_start date,
  rental_end date,
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

-- FEEDBACK (customer feedback; written via service role only)
create table public.feedback (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  rating integer not null check (rating between 1 and 5),
  message text not null,
  created_at timestamptz default now()
);

alter table public.feedback enable row level security;

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
create index idx_order_items_rental_period
  on public.order_items (product_id, rental_start, rental_end) where is_rental;
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

-- RLS cannot restrict which columns an UPDATE touches, so the policy above
-- would otherwise let a user set their own role to 'admin'. Restrict client
-- writes to non-sensitive columns via column-level privileges. The
-- service_role key (admin server actions) retains full access.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone, avatar_url, updated_at)
  on public.profiles to authenticated;

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

-- Coupons: no public read policy (service-role only). Codes/values are never
-- exposed to anon/authenticated clients; the app validates via admin client.

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
$$ language plpgsql security definer set search_path = public;

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
$$ language plpgsql set search_path = public;

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

-- Prevent privilege escalation: only the service role may change profiles.role
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

create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- Atomic stock decrement — never drives stock below zero under concurrency
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

-- Atomic coupon usage — enforces max_uses at the database
create or replace function public.increment_coupon_usage(coupon_id uuid)
returns void as $$
begin
  update public.coupons
  set used_count = used_count + 1
  where id = coupon_id
    and (max_uses is null or used_count < max_uses);
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.decrement_product_stock(jsonb) from public, anon, authenticated;
revoke all on function public.increment_coupon_usage(uuid) from public, anon, authenticated;

-- Restore stock when a paid order is cancelled/refunded (inverse of
-- decrement_product_stock; sale lines only). No `stock >=` guard — adding back
-- can't go negative. See migration 012_restore_product_stock.sql.
create or replace function public.increment_product_stock(items jsonb)
returns void as $$
declare
  item jsonb;
begin
  for item in select * from jsonb_array_elements(items)
  loop
    update public.products
    set stock = stock + (item->>'quantity')::int
    where id = (item->>'product_id')::uuid;
  end loop;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.increment_product_stock(jsonb) from public, anon, authenticated;

-- ============================================
-- PUSH NOTIFICATIONS
-- ============================================

-- DEVICE TOKENS (FCM push notification tokens)
create table public.device_tokens (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android' check (platform in ('android', 'ios', 'web')),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_device_tokens_user on public.device_tokens(user_id);
create index idx_device_tokens_active on public.device_tokens(is_active) where is_active = true;

alter table public.device_tokens enable row level security;

create policy "Users manage own device tokens" on public.device_tokens
  for all using (auth.uid() = user_id);
-- Token registration goes through the service-role route (/api/notifications/
-- register-token); no anon insert policy so tokens can't be bound to arbitrary
-- user_ids.

create trigger update_device_tokens_updated_at before update on public.device_tokens
  for each row execute procedure public.update_updated_at();

-- NOTIFICATIONS (history of sent notifications)
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  body text not null,
  image_url text,
  data jsonb default '{}',
  type text not null default 'custom'
    check (type in ('order_update', 'promotion', 'price_drop', 'back_in_stock', 'custom')),
  target_type text not null default 'all'
    check (target_type in ('all', 'user', 'topic')),
  target_value text,
  sent_count integer default 0,
  failed_count integer default 0,
  status text not null default 'draft'
    check (status in ('draft', 'sending', 'sent', 'failed')),
  sent_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index idx_notifications_type on public.notifications(type);
create index idx_notifications_status on public.notifications(status);
create index idx_notifications_created on public.notifications(created_at desc);

alter table public.notifications enable row level security;
