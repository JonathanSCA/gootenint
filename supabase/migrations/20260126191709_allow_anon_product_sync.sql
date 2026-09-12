/*
  # Allow Anonymous Product Sync

  ## Changes
  - Add policies to allow anonymous users (anon role) to sync products
  - This enables the backend server to perform product synchronization
  - Note: In production, this should be restricted to authenticated admins only

  ## Security Note
  These policies allow anon users to write product data. This is acceptable for:
  - Development environments
  - Trusted backend servers using the anon key
  
  For production, consider:
  - Using service role key for admin operations
  - Implementing proper authentication for admin endpoints
*/

-- Allow anon users to insert/update categories for sync
CREATE POLICY "Anon users can insert categories"
  ON categories FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update categories"
  ON categories FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon users to insert/update products for sync
CREATE POLICY "Anon users can insert products"
  ON products FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update products"
  ON products FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon users to insert/update variants for sync
CREATE POLICY "Anon users can insert variants"
  ON product_variants FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update variants"
  ON product_variants FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon users to insert/update images for sync
CREATE POLICY "Anon users can insert images"
  ON product_images FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update images"
  ON product_images FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon users to insert/update sync logs
CREATE POLICY "Anon users can insert sync logs"
  ON sync_logs FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update sync logs"
  ON sync_logs FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can view sync logs"
  ON sync_logs FOR SELECT
  TO anon
  USING (true);
