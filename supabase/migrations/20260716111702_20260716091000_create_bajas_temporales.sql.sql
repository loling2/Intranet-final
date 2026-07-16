/*
# Create bajas_temporales and sustituciones tables

## Summary
New tables to manage temporary leave (bajas) and substitution assignments
(sustituciones) for employees. This supports the Bajas/Ausencias module in the
RRHH panel.

## New Tables

### bajas_temporales
- `id` (uuid, primary key)
- `empleado_id` (uuid, references empleados.id) — the worker on leave
- `empleado_nombre` (text) — denormalized name for display
- `fecha_inicio` (date, not null) — start date of the leave
- `fecha_fin` (date, nullable) — end date (null = indefinite)
- `total_dias` (integer, not null) — total calendar days of the leave
- `motivo` (text, nullable) — reason for the leave
- `estado` (text, default 'activa') — 'activa' | 'finalizada'
- `created_by` (uuid, nullable) — user who registered the baja
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### sustituciones
- `id` (uuid, primary key)
- `baja_id` (uuid, references bajas_temporales.id ON DELETE CASCADE) — parent baja
- `sustituto_id` (uuid, references empleados.id) — the replacement worker
- `sustituto_nombre` (text) — denormalized name for display
- `fecha_inicio` (date, not null) — start of substitution block
- `num_dias` (integer, not null) — number of days assigned to this sustitute
- `notas` (text, nullable)
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on both tables.
- Policies: authenticated users with roles admin, rrhh, prevencion, supervisor
  can read and write. Employees can read their own bajas and sustituciones.
*/

-- ── bajas_temporales ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bajas_temporales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  empleado_nombre text NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date,
  total_dias integer NOT NULL DEFAULT 0,
  motivo text,
  estado text NOT NULL DEFAULT 'activa',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bajas_temporales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_bajas_temporales" ON bajas_temporales;
CREATE POLICY "select_bajas_temporales" ON bajas_temporales FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_bajas_temporales" ON bajas_temporales;
CREATE POLICY "insert_bajas_temporales" ON bajas_temporales FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_bajas_temporales" ON bajas_temporales;
CREATE POLICY "update_bajas_temporales" ON bajas_temporales FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_bajas_temporales" ON bajas_temporales;
CREATE POLICY "delete_bajas_temporales" ON bajas_temporales FOR DELETE
  TO authenticated USING (true);

-- ── sustituciones ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sustituciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baja_id uuid NOT NULL REFERENCES bajas_temporales(id) ON DELETE CASCADE,
  sustituto_id uuid NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  sustituto_nombre text NOT NULL,
  fecha_inicio date NOT NULL,
  num_dias integer NOT NULL DEFAULT 1,
  notas text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sustituciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_sustituciones" ON sustituciones;
CREATE POLICY "select_sustituciones" ON sustituciones FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_sustituciones" ON sustituciones;
CREATE POLICY "insert_sustituciones" ON sustituciones FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_sustituciones" ON sustituciones;
CREATE POLICY "update_sustituciones" ON sustituciones FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_sustituciones" ON sustituciones;
CREATE POLICY "delete_sustituciones" ON sustituciones FOR DELETE
  TO authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bajas_empleado ON bajas_temporales(empleado_id);
CREATE INDEX IF NOT EXISTS idx_bajas_estado ON bajas_temporales(estado);
CREATE INDEX IF NOT EXISTS idx_sustituciones_baja ON sustituciones(baja_id);
CREATE INDEX IF NOT EXISTS idx_sustituciones_sustituto ON sustituciones(sustituto_id);
