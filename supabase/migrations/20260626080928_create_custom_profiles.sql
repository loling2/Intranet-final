
CREATE TABLE IF NOT EXISTS custom_profiles (
  id text PRIMARY KEY,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#475569',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE custom_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_custom_profiles" ON custom_profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_insert_custom_profiles" ON custom_profiles
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_update_custom_profiles" ON custom_profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_delete_custom_profiles" ON custom_profiles
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
