/*
  # Add site tagline settings

  Stores the top-of-page scripture banner as editable plain text.
*/

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins and super users can manage site settings" ON public.site_settings;

CREATE POLICY "Anyone can view site settings"
  ON public.site_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins and super users can manage site settings"
  ON public.site_settings FOR ALL
  TO authenticated
  USING (public.has_app_role(ARRAY['admin','super_user']::public.app_role[]))
  WITH CHECK (public.has_app_role(ARRAY['admin','super_user']::public.app_role[]));

DROP TRIGGER IF EXISTS update_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO public.site_settings (key, value)
VALUES (
  'site_tagline',
  '{"quoteText":"Your word is a lamp to my feet and a light to my path.","attribution":"PSALM 119:105"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
