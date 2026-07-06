-- Restore stock when a paid order is cancelled/refunded.
--
-- decrement_product_stock runs on payment for sale lines; there was no inverse,
-- so cancelling/refunding a paid order silently lost that inventory. This RPC is
-- the inverse and is called from admin updateOrderStatus on the transition into
-- cancelled/refunded (sale lines only — rentals never decrement).
--
-- No `stock >=` guard: adding stock back can never drive it negative. Runs with
-- definer privileges and is reachable only through the service-role client.
--
-- NOTE: confirm no existing increment_product_stock(jsonb) overload with a
-- different signature exists in the live DB before applying, otherwise this
-- creates an overload instead of replacing (same caveat as 011).

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
