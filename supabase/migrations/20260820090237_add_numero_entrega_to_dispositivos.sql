/*
# Add "numero_entrega" to dispositivos

1. Modified Tables
- `dispositivos`
  - Added `numero_entrega` (integer, nullable) — sequential delivery number
    assigned automatically when a device is assigned to an employee.
2. Security
- No RLS policy changes needed; existing policies on `dispositivos` already
  cover the new column (column-level privileges are inherited from table policies).
3. Notes
- The column is nullable so existing rows are not affected.
- The frontend computes the next number as MAX(numero_entrega) + 1 at
  assignment time and writes it back to the row.
*/

ALTER TABLE dispositivos
  ADD COLUMN IF NOT EXISTS numero_entrega integer;

CREATE INDEX IF NOT EXISTS dispositivos_numero_entrega_idx
  ON dispositivos(numero_entrega DESC);
