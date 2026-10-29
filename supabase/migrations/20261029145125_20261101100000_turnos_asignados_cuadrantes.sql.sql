/*
# Turnos asignados (planificación de cuadrantes)

## Summary
Adds a table to store the shifts planned for each employee on each day, so
administrators can assign and later modify them from the cuadrantes screen.
Actual clock-ins (fichajes) are not changed by this migration.

## 1. New table: turnos_asignados
- `id` (uuid, primary key)
- `empleado_id` (uuid, required) -> empleados(id), removed with the employee
- `centro_id` (uuid, optional) -> centros(id), the centre the shift was planned in
- `fecha` (date, required) -> the day of the shift
- `inicio` (time, required) -> planned start
- `fin` (time, required) -> planned end (may be earlier than inicio for night shifts)
- `created_at`, `updated_at` (timestamptz)
- Unique (empleado_id, fecha): one planned shift per employee per day.

## 2. Security
- RLS enabled on turnos_asignados.
- Grants: SELECT, INSERT, UPDATE, DELETE to `authenticated` only.
- One policy per verb, all restricted to `is_admin_or_rrhh()`.

## Notes
- Existing tables and data are not modified.
*/

CREATE TABLE IF NOT EXISTS turnos_asignados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  centro_id uuid REFERENCES centros(id) ON DELETE SET NULL,
  fecha date NOT NULL,
  inicio time NOT NULL,
  fin time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT turnos_asignados_empleado_fecha_key UNIQUE (empleado_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_turnos_asignados_centro_fecha ON turnos_asignados(centro_id, fecha);

ALTER TABLE turnos_asignados ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON turnos_asignados TO authenticated;

DROP POLICY IF EXISTS "select_turnos_asignados" ON turnos_asignados;
CREATE POLICY "select_turnos_asignados" ON turnos_asignados FOR SELECT
  TO authenticated
  USING (is_admin_or_rrhh());

DROP POLICY IF EXISTS "insert_turnos_asignados" ON turnos_asignados;
CREATE POLICY "insert_turnos_asignados" ON turnos_asignados FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_rrhh());

DROP POLICY IF EXISTS "update_turnos_asignados" ON turnos_asignados;
CREATE POLICY "update_turnos_asignados" ON turnos_asignados FOR UPDATE
  TO authenticated
  USING (is_admin_or_rrhh())
  WITH CHECK (is_admin_or_rrhh());

DROP POLICY IF EXISTS "delete_turnos_asignados" ON turnos_asignados;
CREATE POLICY "delete_turnos_asignados" ON turnos_asignados FOR DELETE
  TO authenticated
  USING (is_admin_or_rrhh());
