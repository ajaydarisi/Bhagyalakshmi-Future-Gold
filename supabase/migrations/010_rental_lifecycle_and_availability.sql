-- Rental lifecycle: orders get a type (sale/rental/mixed) and a rental status
-- (booked -> active -> returned; overdue is derived, never stored). Rental
-- availability is computed from overlapping booked order_items, so add a
-- partial index for the overlap query.

alter table public.orders
  add column if not exists order_type text not null default 'sale'
    check (order_type in ('sale', 'rental', 'mixed')),
  add column if not exists rental_status text
    check (rental_status in ('booked', 'active', 'returned'));

create index if not exists idx_order_items_rental_period
  on public.order_items (product_id, rental_start, rental_end)
  where is_rental;

-- Backfill orders created before this migration
update public.orders o
set order_type = case
  when exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.is_rental)
       and exists (select 1 from public.order_items oi where oi.order_id = o.id and not oi.is_rental)
    then 'mixed'
  when exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.is_rental)
    then 'rental'
  else 'sale'
end;

update public.orders
set rental_status = case
  when status = 'delivered' then 'active'
  when status in ('paid', 'processing', 'shipped') then 'booked'
end
where order_type != 'sale';
