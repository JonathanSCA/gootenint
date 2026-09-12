/*
  # eCommerce Product Database Schema

  ## Overview
  This migration creates a comprehensive product database that syncs with Gooten API data.
  It supports multi-variant products, pricing, inventory, images, and categories.

  ## New Tables

  ### 1. `categories`
  Product categories for organization and filtering
    - `id` (uuid, primary key)
    - `name` (text, unique) - Category name
    - `slug` (text, unique) - URL-friendly identifier
    - `description` (text, nullable) - Category description
    - `parent_id` (uuid, nullable) - For nested categories
    - `sort_order` (integer) - Display order
    - `is_active` (boolean) - Active/inactive status
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### 2. `products`
  Main product information (e.g., "Canvas Prints", "T-Shirts")
    - `id` (uuid, primary key)
    - `gooten_product_id` (text, unique, nullable) - Gooten product ID
    - `name` (text) - Product name
    - `slug` (text, unique) - URL-friendly identifier
    - `description` (text, nullable) - Full description
    - `short_description` (text, nullable) - Brief description
    - `category_id` (uuid, foreign key to categories)
    - `base_price` (decimal) - Starting price
    - `is_active` (boolean) - Published status
    - `is_featured` (boolean) - Featured product
    - `metadata` (jsonb) - Additional data from Gooten
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
    - `synced_at` (timestamptz, nullable) - Last Gooten sync

  ### 3. `product_variants`
  Specific product variations (e.g., "Red T-Shirt Large", "16x20 Canvas")
    - `id` (uuid, primary key)
    - `product_id` (uuid, foreign key to products)
    - `gooten_sku` (text, unique, nullable) - Gooten SKU
    - `name` (text) - Variant name
    - `sku` (text, unique) - Store SKU
    - `price` (decimal) - Selling price
    - `compare_at_price` (decimal, nullable) - Original price for discounts
    - `cost` (decimal, nullable) - Cost price
    - `size` (text, nullable) - Size option
    - `color` (text, nullable) - Color option
    - `material` (text, nullable) - Material option
    - `weight` (decimal, nullable) - Shipping weight
    - `dimensions` (jsonb, nullable) - Width, height, depth
    - `inventory_quantity` (integer) - Stock level
    - `track_inventory` (boolean) - Track stock
    - `allow_backorder` (boolean) - Allow out-of-stock orders
    - `is_active` (boolean) - Active status
    - `sort_order` (integer) - Display order
    - `metadata` (jsonb) - Additional variant data
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### 4. `product_images`
  Product and variant images
    - `id` (uuid, primary key)
    - `product_id` (uuid, foreign key to products, nullable)
    - `variant_id` (uuid, foreign key to product_variants, nullable)
    - `url` (text) - Image URL
    - `alt_text` (text, nullable) - Alt text for accessibility
    - `sort_order` (integer) - Display order
    - `is_primary` (boolean) - Primary image flag
    - `width` (integer, nullable) - Image width
    - `height` (integer, nullable) - Image height
    - `created_at` (timestamptz)

  ### 5. `product_templates`
  Gooten design templates for customizable products
    - `id` (uuid, primary key)
    - `variant_id` (uuid, foreign key to product_variants)
    - `gooten_sku` (text) - Gooten SKU
    - `template_data` (jsonb) - Full template specification
    - `spaces` (jsonb) - Customizable spaces
    - `layers` (jsonb) - Design layers
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### 6. `sync_logs`
  Track synchronization with Gooten API
    - `id` (uuid, primary key)
    - `sync_type` (text) - Type: products, variants, templates
    - `status` (text) - Status: success, failed, partial
    - `products_synced` (integer) - Count of products synced
    - `variants_synced` (integer) - Count of variants synced
    - `errors` (jsonb, nullable) - Error details if failed
    - `started_at` (timestamptz)
    - `completed_at` (timestamptz, nullable)
    - `duration_ms` (integer, nullable) - Sync duration

  ## Security
  - Enable RLS on all tables
  - Public read access for active products (storefront)
  - Authenticated write access (admin functions)
*/

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gooten_product_id text UNIQUE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  short_description text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  base_price decimal(10,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  synced_at timestamptz
);

-- Create product_variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  gooten_sku text UNIQUE,
  name text NOT NULL,
  sku text NOT NULL UNIQUE,
  price decimal(10,2) DEFAULT 0,
  compare_at_price decimal(10,2),
  cost decimal(10,2),
  size text,
  color text,
  material text,
  weight decimal(10,3),
  dimensions jsonb,
  inventory_quantity integer DEFAULT 999,
  track_inventory boolean DEFAULT false,
  allow_backorder boolean DEFAULT true,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create product_images table
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt_text text,
  sort_order integer DEFAULT 0,
  is_primary boolean DEFAULT false,
  width integer,
  height integer,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT product_or_variant_required CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL)
);

-- Create product_templates table
CREATE TABLE IF NOT EXISTS product_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  gooten_sku text NOT NULL,
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  spaces jsonb DEFAULT '[]'::jsonb,
  layers jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(variant_id, gooten_sku)
);

-- Create sync_logs table
CREATE TABLE IF NOT EXISTS sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  products_synced integer DEFAULT 0,
  variants_synced integer DEFAULT 0,
  errors jsonb,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_gooten_id ON products(gooten_product_id);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_gooten_sku ON product_variants(gooten_sku);
CREATE INDEX IF NOT EXISTS idx_variants_active ON product_variants(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_images_variant ON product_images(variant_id);
CREATE INDEX IF NOT EXISTS idx_templates_variant ON product_templates(variant_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_type ON sync_logs(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);

-- Enable Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public read access for active products (storefront)

-- Categories: Anyone can view active categories
CREATE POLICY "Anyone can view active categories"
  ON categories FOR SELECT
  USING (is_active = true);

-- Products: Anyone can view active products
CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT
  USING (is_active = true);

-- Product Variants: Anyone can view active variants of active products
CREATE POLICY "Anyone can view active variants"
  ON product_variants FOR SELECT
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variants.product_id
      AND products.is_active = true
    )
  );

-- Product Images: Anyone can view images of active products/variants
CREATE POLICY "Anyone can view product images"
  ON product_images FOR SELECT
  USING (
    (product_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
      AND products.is_active = true
    ))
    OR
    (variant_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.id = product_images.variant_id
      AND pv.is_active = true
      AND p.is_active = true
    ))
  );

-- Product Templates: Anyone can view templates for active variants
CREATE POLICY "Anyone can view product templates"
  ON product_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.id = product_templates.variant_id
      AND pv.is_active = true
      AND p.is_active = true
    )
  );

-- Sync Logs: Only authenticated users can view sync logs
CREATE POLICY "Authenticated users can view sync logs"
  ON sync_logs FOR SELECT
  TO authenticated
  USING (true);

-- Admin write policies (authenticated users can manage products)
CREATE POLICY "Authenticated users can insert categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert variants"
  ON product_variants FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update variants"
  ON product_variants FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete variants"
  ON product_variants FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert images"
  ON product_images FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update images"
  ON product_images FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete images"
  ON product_images FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert templates"
  ON product_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update templates"
  ON product_templates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete templates"
  ON product_templates FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sync logs"
  ON sync_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sync logs"
  ON sync_logs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at columns
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_templates_updated_at BEFORE UPDATE ON product_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
