-- 008: Performance — RLS init-plan optimization + missing FK indexes
--
-- Supabase's performance advisor flagged two classes of issue:
--   1. auth_rls_initplan: policies call auth.uid() per row. Wrapping as
--      (select auth.uid()) lets Postgres evaluate it once per query (initplan)
--      instead of once per row.
--   2. unindexed_foreign_keys: FK columns without a covering index slow joins
--      and cascading updates/deletes.

-- ── RLS: wrap auth.uid() in a scalar subquery ────────────────────────────────

alter policy "Users manage own addresses" on public.addresses
  using (((select auth.uid()) = user_id));

alter policy "Users manage own cart" on public.cart_items
  using (((select auth.uid()) = user_id));

alter policy "Users manage own device tokens" on public.device_tokens
  using (((select auth.uid()) = user_id));

alter policy "Users manage own wishlist" on public.wishlist_items
  using (((select auth.uid()) = user_id));

alter policy "Users can view own orders" on public.orders
  using (((select auth.uid()) = user_id));

alter policy "Users can insert own orders" on public.orders
  with check (((select auth.uid()) = user_id));

alter policy "Users can view own order items" on public.order_items
  using (exists (
    select 1 from orders
    where orders.id = order_items.order_id
      and orders.user_id = (select auth.uid())
  ));

alter policy "Users can view status history for their orders" on public.order_status_history
  using (exists (
    select 1 from orders
    where orders.id = order_status_history.order_id
      and orders.user_id = (select auth.uid())
  ));

alter policy "Users can view own transactions" on public.payment_transactions
  using (exists (
    select 1 from orders
    where orders.id = payment_transactions.order_id
      and orders.user_id = (select auth.uid())
  ));

alter policy "Users can view own profile" on public.profiles
  using (((select auth.uid()) = id));

alter policy "Users can update own profile" on public.profiles
  using (((select auth.uid()) = id))
  with check (
    ((select auth.uid()) = id)
    and (role = (select p.role from profiles p where p.id = (select auth.uid())))
  );

alter policy "Users can view their own stock alerts" on public.stock_alerts
  using (((select auth.uid()) = user_id));

alter policy "Users can create their own stock alerts" on public.stock_alerts
  with check (((select auth.uid()) = user_id));

alter policy "Users can delete their own stock alerts" on public.stock_alerts
  using (((select auth.uid()) = user_id));

-- ── Missing foreign-key covering indexes ─────────────────────────────────────

create index if not exists idx_cart_items_product on public.cart_items (product_id);
create index if not exists idx_wishlist_items_product on public.wishlist_items (product_id);
create index if not exists idx_feedback_user on public.feedback (user_id);
create index if not exists idx_notifications_created_by on public.notifications (created_by);
create index if not exists idx_order_status_history_changed_by on public.order_status_history (changed_by);
create index if not exists idx_orders_coupon on public.orders (coupon_id);
create index if not exists idx_stock_alerts_user on public.stock_alerts (user_id);
