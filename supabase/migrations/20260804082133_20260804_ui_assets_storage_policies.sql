
-- Allow authenticated users to upload to ui-assets bucket
CREATE POLICY "ui_assets_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ui-assets');

CREATE POLICY "ui_assets_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ui-assets');

CREATE POLICY "ui_assets_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'ui-assets');

CREATE POLICY "ui_assets_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ui-assets');
