/*
# Vacation letters: download tracking + signed letter upload

1. Modified Tables
   - `vacation_requests`
     - `carta_descargada_at` (timestamptz) — when the PDF was first downloaded by HR
     - `carta_descargada_por_nombre` (text) — display name of who downloaded it
     - `carta_firmada_path` (text) — Wasabi key for the signed letter uploaded by HR
     - `carta_firmada_at` (timestamptz) — when the signed letter was uploaded
     - `carta_firmada_por_nombre` (text) — who uploaded the signed letter

2. Security
   - Existing RLS policies on `vacation_requests` already cover authenticated staff — no new policies needed.

3. Notes
   - No columns are dropped; existing data is fully preserved.
   - Nullable columns — both tracking fields start as NULL until the action occurs.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vacation_requests' AND column_name='carta_descargada_at') THEN
    ALTER TABLE vacation_requests ADD COLUMN carta_descargada_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vacation_requests' AND column_name='carta_descargada_por_nombre') THEN
    ALTER TABLE vacation_requests ADD COLUMN carta_descargada_por_nombre text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vacation_requests' AND column_name='carta_firmada_path') THEN
    ALTER TABLE vacation_requests ADD COLUMN carta_firmada_path text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vacation_requests' AND column_name='carta_firmada_at') THEN
    ALTER TABLE vacation_requests ADD COLUMN carta_firmada_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vacation_requests' AND column_name='carta_firmada_por_nombre') THEN
    ALTER TABLE vacation_requests ADD COLUMN carta_firmada_por_nombre text;
  END IF;
END $$;
