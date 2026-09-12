/*
  Ensure mock checkout order policies exist.

  This is intentionally separate from the role migration so it can be run after
  partial testing migrations without recreating the auth role objects.
*/

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_write_order(target_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = target_order_id
    AND (o.user_id IS NULL OR o.user_id = auth.uid())
  );
$$;

DROP POLICY IF EXISTS "Guests and users can create orders" ON public.orders;
CREATE POLICY "Guests and users can create orders"
  ON public.orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Guests and users can create order items" ON public.order_items;
CREATE POLICY "Guests and users can create order items"
  ON public.order_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.can_write_order(order_id));

DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
      AND (
        o.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.user_id = auth.uid()
          AND user_roles.role = 'admin'
        )
      )
    )
  );
