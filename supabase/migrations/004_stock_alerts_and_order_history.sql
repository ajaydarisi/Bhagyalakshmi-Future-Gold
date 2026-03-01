-- Stock Alerts: allow users to subscribe to out-of-stock product notifications
create table if not exists public.stock_alerts (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  notified_at timestamptz,
  unique(product_id, user_id)
);

alter table public.stock_alerts enable row level security;

create policy "Users can view their own stock alerts"
  on public.stock_alerts for select
  using (auth.uid() = user_id);

create policy "Users can create their own stock alerts"
  on public.stock_alerts for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own stock alerts"
  on public.stock_alerts for delete
  using (auth.uid() = user_id);

-- Order Status History: track when each status change happened
create table if not exists public.order_status_history (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  status text not null,
  changed_at timestamptz default now(),
  changed_by uuid references public.profiles(id) on delete set null
);

alter table public.order_status_history enable row level security;

create policy "Users can view status history for their orders"
  on public.order_status_history for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_status_history.order_id
        and orders.user_id = auth.uid()
    )
  );

-- Allow service role (admin) to insert status history
create policy "Service role can insert status history"
  on public.order_status_history for insert
  with check (true);

-- Index for fast lookups
create index if not exists idx_stock_alerts_product on public.stock_alerts(product_id);
create index if not exists idx_order_status_history_order on public.order_status_history(order_id);
