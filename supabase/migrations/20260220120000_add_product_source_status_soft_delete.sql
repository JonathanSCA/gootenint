/*
  # Add product source/status for non-destructive multi-source sync

  ## Goals
  - Track product ownership/source (`manual`, `gooten`, `other`)
  - Track lifecycle status (`pending`, `published`, `deleted`, `archived`)
  - Support soft delete for removed upstream products (`deleted_at`)
  - Preserve existing product data with safe backfill
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE products
SET source = CASE
  WHEN gooten_product_id IS NOT NULL THEN 'gooten'
  ELSE 'manual'
END
WHERE source IS NULL;

UPDATE products
SET status = CASE
  WHEN is_active = true THEN 'published'
  ELSE 'pending'
END
WHERE status IS NULL;

ALTER TABLE products
  ALTER COLUMN source SET DEFAULT 'manual',
  ALTER COLUMN status SET DEFAULT 'published';

ALTER TABLE products
  ALTER COLUMN source SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_source_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_source_check
      CHECK (source IN ('manual', 'gooten', 'other'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_status_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_status_check
      CHECK (status IN ('pending', 'published', 'deleted', 'archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_source ON products(source);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
