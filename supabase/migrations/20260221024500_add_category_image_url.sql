/*
  # Add category image support

  Adds an optional image URL column for category presentation in admin and storefront.
*/

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS image_url text;
