/*
# Fix typo: add correctly-spelled horas_festivas column

1. New Columns
- `sustituciones.horas_festivas` (numeric, default 0) — correctly-spelled version for festivo hours
2. Notes
- Previous migration had a typo (horas_festicas). This adds the correct column.
- The typo'd column is left in place to avoid data loss.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sustituciones' AND column_name = 'horas_festivas') THEN
    ALTER TABLE sustituciones ADD COLUMN horas_festivas numeric DEFAULT 0;
  END IF;
END $$;