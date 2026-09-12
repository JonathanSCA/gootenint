/*
  # Create Gooten API Cache Tables

  1. New Tables
    - `gooten_product_cache`
      - `id` (uuid, primary key)
      - `product_name` (text, unique)
      - `country_code` (text)
      - `data` (jsonb) - cached product data
      - `cached_at` (timestamptz)
      - `expires_at` (timestamptz)
    
    - `gooten_variant_cache`
      - `id` (uuid, primary key)
      - `product_name` (text)
      - `country_code` (text)
      - `data` (jsonb) - cached variant data
      - `cached_at` (timestamptz)
      - `expires_at` (timestamptz)
      - Unique constraint on (product_name, country_code)
    
    - `gooten_content_cache`
      - `id` (uuid, primary key)
      - `sku` (text, unique)
      - `content_data` (jsonb) - cached content/description data
      - `cached_at` (timestamptz)
      - `expires_at` (timestamptz)
    
    - `gooten_image_cache`
      - `id` (uuid, primary key)
      - `sku` (text, unique)
      - `image_data` (jsonb) - cached image template data
      - `cached_at` (timestamptz)
      - `expires_at` (timestamptz)
    
    - `api_rate_limit`
      - `id` (uuid, primary key)
      - `endpoint` (text, unique)
      - `request_count` (integer)
      - `window_start` (timestamptz)
      - `last_request` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for service role access (backend only)
    
  3. Indexes
    - Add indexes on lookup columns for performance
    - Add index on expires_at for cache cleanup

  4. Notes
    - Cache duration: 24 hours to minimize API calls
    - Rate limiting: Track requests per endpoint
    - Backend-only access via service role key
*/

CREATE TABLE IF NOT EXISTS gooten_product_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text,
  country_code text DEFAULT 'US',
  data jsonb NOT NULL,
  cached_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  UNIQUE(product_name, country_code)
);

CREATE TABLE IF NOT EXISTS gooten_variant_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  country_code text DEFAULT 'US',
  data jsonb NOT NULL,
  cached_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  UNIQUE(product_name, country_code)
);

CREATE TABLE IF NOT EXISTS gooten_content_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  content_data jsonb NOT NULL,
  cached_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

CREATE TABLE IF NOT EXISTS gooten_image_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  image_data jsonb NOT NULL,
  cached_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

CREATE TABLE IF NOT EXISTS api_rate_limit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text UNIQUE NOT NULL,
  request_count integer DEFAULT 0,
  window_start timestamptz DEFAULT now(),
  last_request timestamptz DEFAULT now()
);

ALTER TABLE gooten_product_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE gooten_variant_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE gooten_content_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE gooten_image_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to product cache"
  ON gooten_product_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to variant cache"
  ON gooten_variant_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to content cache"
  ON gooten_content_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to image cache"
  ON gooten_image_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to rate limit"
  ON api_rate_limit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_product_cache_expires ON gooten_product_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_variant_cache_expires ON gooten_variant_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_content_cache_expires ON gooten_content_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_image_cache_expires ON gooten_image_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_product_cache_lookup ON gooten_product_cache(product_name, country_code);
CREATE INDEX IF NOT EXISTS idx_variant_cache_lookup ON gooten_variant_cache(product_name, country_code);
CREATE INDEX IF NOT EXISTS idx_content_cache_sku ON gooten_content_cache(sku);
CREATE INDEX IF NOT EXISTS idx_image_cache_sku ON gooten_image_cache(sku);
