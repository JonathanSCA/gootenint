/*
  Role-based security and shopper order history.

  Roles:
  - admin: full site administration
  - super_user: full product administration
  - publisher: can manage products they created
  - shopper: can browse, checkout, and view their own orders

  After applying this migration, promote the first administrator manually:
    update public.user_roles
    set role = 'admin'
    where user_id = '<auth.users.id>';
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'super_user', 'publisher', 'shopper');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'shopper',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_created_by ON public.products(created_by);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  status text NOT NULL DEFAULT 'completed',
  total_amount decimal(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_slug text,
  variant_name text,
  sku text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price decimal(10,2) NOT NULL DEFAULT 0,
  image_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid()),
    'shopper'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_app_role(required_roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_app_role() = ANY(required_roles);
$$;

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

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'shopper')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_app_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_app_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

INSERT INTO public.profiles (user_id, email)
SELECT id, email FROM auth.users
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'shopper'::public.app_role FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon users can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Anon users can update categories" ON public.categories;
DROP POLICY IF EXISTS "Anon users can insert products" ON public.products;
DROP POLICY IF EXISTS "Anon users can update products" ON public.products;
DROP POLICY IF EXISTS "Anon users can insert variants" ON public.product_variants;
DROP POLICY IF EXISTS "Anon users can update variants" ON public.product_variants;
DROP POLICY IF EXISTS "Anon users can insert images" ON public.product_images;
DROP POLICY IF EXISTS "Anon users can update images" ON public.product_images;
DROP POLICY IF EXISTS "Anon users can insert sync logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Anon users can update sync logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Anon users can view sync logs" ON public.sync_logs;

DROP POLICY IF EXISTS "Authenticated users can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can insert variants" ON public.product_variants;
DROP POLICY IF EXISTS "Authenticated users can update variants" ON public.product_variants;
DROP POLICY IF EXISTS "Authenticated users can delete variants" ON public.product_variants;
DROP POLICY IF EXISTS "Authenticated users can insert images" ON public.product_images;
DROP POLICY IF EXISTS "Authenticated users can update images" ON public.product_images;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON public.product_images;
DROP POLICY IF EXISTS "Authenticated users can insert templates" ON public.product_templates;
DROP POLICY IF EXISTS "Authenticated users can update templates" ON public.product_templates;
DROP POLICY IF EXISTS "Authenticated users can delete templates" ON public.product_templates;
DROP POLICY IF EXISTS "Authenticated users can view sync logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Authenticated users can insert sync logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Authenticated users can update sync logs" ON public.sync_logs;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_app_role(ARRAY['admin']::public.app_role[]));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_app_role(ARRAY['admin']::public.app_role[]))
  WITH CHECK (user_id = auth.uid() OR public.has_app_role(ARRAY['admin']::public.app_role[]));

CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_app_role(ARRAY['admin']::public.app_role[]));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_app_role(ARRAY['admin']::public.app_role[]))
  WITH CHECK (public.has_app_role(ARRAY['admin']::public.app_role[]));

CREATE POLICY "Staff can view all categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (public.has_app_role(ARRAY['admin','super_user','publisher']::public.app_role[]));

CREATE POLICY "Admins and super users can manage categories"
  ON public.categories FOR ALL
  TO authenticated
  USING (public.has_app_role(ARRAY['admin','super_user']::public.app_role[]))
  WITH CHECK (public.has_app_role(ARRAY['admin','super_user']::public.app_role[]));

CREATE POLICY "Staff can view managed products"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    public.has_app_role(ARRAY['admin','super_user']::public.app_role[])
    OR (public.current_app_role() = 'publisher'::public.app_role AND created_by = auth.uid())
  );

CREATE POLICY "Product staff can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_app_role(ARRAY['admin','super_user']::public.app_role[])
    OR (public.current_app_role() = 'publisher'::public.app_role AND created_by = auth.uid())
  );

CREATE POLICY "Product staff can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (
    public.has_app_role(ARRAY['admin','super_user']::public.app_role[])
    OR (public.current_app_role() = 'publisher'::public.app_role AND created_by = auth.uid())
  )
  WITH CHECK (
    public.has_app_role(ARRAY['admin','super_user']::public.app_role[])
    OR (public.current_app_role() = 'publisher'::public.app_role AND created_by = auth.uid())
  );

CREATE POLICY "Product staff can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (
    public.has_app_role(ARRAY['admin','super_user']::public.app_role[])
    OR (public.current_app_role() = 'publisher'::public.app_role AND created_by = auth.uid())
  );

CREATE POLICY "Product staff can manage variants"
  ON public.product_variants FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variants.product_id
      AND (
        public.has_app_role(ARRAY['admin','super_user']::public.app_role[])
        OR (public.current_app_role() = 'publisher'::public.app_role AND p.created_by = auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variants.product_id
      AND (
        public.has_app_role(ARRAY['admin','super_user']::public.app_role[])
        OR (public.current_app_role() = 'publisher'::public.app_role AND p.created_by = auth.uid())
      )
    )
  );

CREATE POLICY "Product staff can manage images"
  ON public.product_images FOR ALL
  TO authenticated
  USING (
    public.has_app_role(ARRAY['admin','super_user']::public.app_role[])
    OR EXISTS (
      SELECT 1 FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
      WHERE pv.id = product_images.variant_id
      AND public.current_app_role() = 'publisher'::public.app_role
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id
      AND public.current_app_role() = 'publisher'::public.app_role
      AND p.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.has_app_role(ARRAY['admin','super_user']::public.app_role[])
    OR EXISTS (
      SELECT 1 FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
      WHERE pv.id = product_images.variant_id
      AND public.current_app_role() = 'publisher'::public.app_role
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id
      AND public.current_app_role() = 'publisher'::public.app_role
      AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Product staff can manage templates"
  ON public.product_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
      WHERE pv.id = product_templates.variant_id
      AND (
        public.has_app_role(ARRAY['admin','super_user']::public.app_role[])
        OR (public.current_app_role() = 'publisher'::public.app_role AND p.created_by = auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
      WHERE pv.id = product_templates.variant_id
      AND (
        public.has_app_role(ARRAY['admin','super_user']::public.app_role[])
        OR (public.current_app_role() = 'publisher'::public.app_role AND p.created_by = auth.uid())
      )
    )
  );

CREATE POLICY "Admins and super users can view sync logs"
  ON public.sync_logs FOR SELECT
  TO authenticated
  USING (public.has_app_role(ARRAY['admin','super_user']::public.app_role[]));

CREATE POLICY "Admins and super users can insert sync logs"
  ON public.sync_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_app_role(ARRAY['admin','super_user']::public.app_role[]));

CREATE POLICY "Admins and super users can update sync logs"
  ON public.sync_logs FOR UPDATE
  TO authenticated
  USING (public.has_app_role(ARRAY['admin','super_user']::public.app_role[]))
  WITH CHECK (public.has_app_role(ARRAY['admin','super_user']::public.app_role[]));

CREATE POLICY "Guests and users can create orders"
  ON public.orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_app_role(ARRAY['admin']::public.app_role[]));

CREATE POLICY "Guests and users can create order items"
  ON public.order_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.can_write_order(order_id));

CREATE POLICY "Users can view own order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
      AND (o.user_id = auth.uid() OR public.has_app_role(ARRAY['admin']::public.app_role[]))
    )
  );
