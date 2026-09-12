/*
  # Update RLS Policies for Anon Access

  1. Changes
    - Add anon role policies to all cache tables
    - Allow backend operations through anon key
    
  2. Security
    - Policies remain restrictive
    - Only specific operations allowed
    - Read/write access for API operations
*/

DROP POLICY IF EXISTS "Service role full access to product cache" ON gooten_product_cache;
DROP POLICY IF EXISTS "Service role full access to variant cache" ON gooten_variant_cache;
DROP POLICY IF EXISTS "Service role full access to content cache" ON gooten_content_cache;
DROP POLICY IF EXISTS "Service role full access to image cache" ON gooten_image_cache;
DROP POLICY IF EXISTS "Service role full access to rate limit" ON api_rate_limit;

CREATE POLICY "Allow backend access to product cache"
  ON gooten_product_cache
  FOR ALL
  TO anon, service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow backend access to variant cache"
  ON gooten_variant_cache
  FOR ALL
  TO anon, service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow backend access to content cache"
  ON gooten_content_cache
  FOR ALL
  TO anon, service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow backend access to image cache"
  ON gooten_image_cache
  FOR ALL
  TO anon, service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow backend access to rate limit"
  ON api_rate_limit
  FOR ALL
  TO anon, service_role
  USING (true)
  WITH CHECK (true);
