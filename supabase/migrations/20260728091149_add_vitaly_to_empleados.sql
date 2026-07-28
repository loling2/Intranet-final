/*
# Add Vitaly status tracking to empleados

1. New Columns on `empleados`
- `vitaly_estado` (text, default 'inactivo') — tracks the Vitaly onboarding state.
  Allowed values: 'inactivo' | 'pendiente' | 'activo'. Defaults to 'inactivo' so
  every newly created or imported employee starts inactive.
- `vitaly_motivo` (text, nullable) — free-text reason written by Prevencion when
  moving an employee from 'inactivo' to 'pendiente' (e.g. "pendiente de crear puesto").

2. Backfill
- Existing rows get `vitaly_estado = 'inactivo'` so the Prevencion Vitaly list
  starts empty and only new employees (or manually set ones) appear.

3. Security
- No new tables; RLS already enabled on `empleados`. No policy changes needed.
*/

ALTER TABLE empleados
  ADD COLUMN IF NOT EXISTS vitaly_estado text NOT NULL DEFAULT 'inactivo';

ALTER TABLE empleados
  ADD COLUMN IF NOT EXISTS vitaly_motivo text;

-- Backfill any pre-existing rows that predate the column default
UPDATE empleados SET vitaly_estado = 'inactivo' WHERE vitaly_estado IS NULL;
