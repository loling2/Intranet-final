/*
# Add descontado column to bajas_temporales

1. Modified Tables
- `bajas_temporales`: add `descontado` (boolean, default false)
  - When true, the PNR/Reposo absence has been compensated/deducted
  - Descontada absences are removed from the balance and shown separately in exports
2. Security
- No RLS policy changes — existing CRUD policies cover the new column automatically.
3. Notes
- Idempotent: uses DO $$ ... IF NOT EXISTS ... END $$ guard.
- No data loss: existing rows default to descontado = false.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bajas_temporales' AND column_name = 'descontado'
  ) THEN
    ALTER TABLE bajas_temporales ADD COLUMN descontado BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
