-- Rental checkout: cart and order items carry the rental period so rental
-- products are priced at rental_price/day × days, and rental_end doubles as
-- the return-due date shown to the customer.

alter table public.cart_items
  add column if not exists rental_start date,
  add column if not exists rental_end date;

alter table public.order_items
  add column if not exists is_rental boolean not null default false,
  add column if not exists rental_start date,
  add column if not exists rental_end date;

-- FEEDBACK: table was live in production but missing a CREATE TABLE in the
-- repo (migration 008 already indexes it). Writes go through the service role.
create table if not exists public.feedback (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  rating integer not null check (rating between 1 and 5),
  message text not null,
  created_at timestamptz default now()
);

alter table public.feedback enable row level security;

create index if not exists idx_feedback_user on public.feedback (user_id);
