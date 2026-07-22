/*
# Add festivo/nocturnidad fields to sustituciones

1. New Columns
- `sustituciones.unidad_festivo` (text, default 'dias') — unit for festivo coverage: 'dias' or 'horas'
- `sustituciones.horas_festivas` (numeric, default 0) — number of festivo hours when unidad_festivo = 'horas'
- `sustituciones.es_nocturno` (boolean, default false) — independent nocturnidad toggle, separate from turno=noche

2. Modified Tables
- `sustituciones` — added 3 new columns to allow festivo to be measured in hours (not just days)
  and to allow nocturnidad to be toggled independently of the shift being "noche"

3. Notes
- These are additive columns with defaults, so existing rows are unaffected
- No RLS changes needed — existing policies cover the new columns
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sustituciones' AND column_name = 'unidad_festivo') THEN
    ALTER TABLE sustituciones ADD COLUMN unidad_festivo text DEFAULT 'dias';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sustituciones' AND column_name = 'horas_festivas') THEN
    ALTER TABLE sustituciones ADD COLUMN horas_festicas numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sustituciones' AND column_name = 'es_nocturno') THEN
    ALTER TABLE sustituciones ADD COLUMN es_nocturno boolean DEFAULT false;
  END IF;
END $$;