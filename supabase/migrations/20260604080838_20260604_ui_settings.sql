/*
  # UI Settings Table

  1. New Tables
    - `ui_settings`
      - `key` (text, primary key) — setting name e.g. "login_background", "society_color_<id>"
      - `value` (text) — setting value (URL or hex color)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Admins (role = 'admin') can read and write
    - Everyone can SELECT (needed for login page background)
*/

CREATE TABLE IF NOT EXISTS ui_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ui_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ui_settings"
  ON ui_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert ui_settings"
  ON ui_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update ui_settings"
  ON ui_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Seed default login background
INSERT INTO ui_settings (key, value)
VALUES ('login_background', '/foto1_(2).png')
ON CONFLICT (key) DO NOTHING;
