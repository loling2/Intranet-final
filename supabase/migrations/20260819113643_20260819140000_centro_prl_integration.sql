/*
# Centro - Tablet - Fichaje - PRL Integration

## Summary
This migration implements the integrated flow between Centros, Tablets, Fichajes
and PRL document delivery. It adds:
1. `centro_id` (uuid) to `empleados` to track the employee's current work center.
2. `employee_centro_history` table to accumulate the historical rotation of centers.
3. `centro_id` (uuid) to `prl_folders` to link PRL folders to specific centers.
4. `puesto_tags` table for job-position sub-tags (e.g. "Psicologo", "Gerocultor").
5. `prl_document_puesto_tags` table to assign one or more puesto tags to each PRL document.
6. RLS policies on all new tables.

## New Tables
- `employee_centro_history`: records every center an employee has rotated through.
- `puesto_tags`: catalog of job-position tags for PRL document filtering.
- `prl_document_puesto_tags`: many-to-many between prl_documents and puesto_tags.

## Modified Tables
- `empleados`: adds `centro_id` (uuid, nullable) referencing centros.
- `prl_folders`: adds `centro_id` (uuid, nullable) referencing centros.

## Security
- RLS enabled on all new tables.
- employee_centro_history: employees read own; admin/prevencion read all; insert by system.
- puesto_tags: readable by all authenticated; writable by admin/prevencion.
- prl_document_puesto_tags: readable by all authenticated; writable by admin/prevencion.
*/

-- 1. Add centro_id to empleados
DO $$ BEGIN
  ALTER TABLE empleados ADD COLUMN centro_id uuid REFERENCES centros(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 2. Backfill centro_id from centro_trabajo name match
UPDATE empleados e
SET centro_id = c.id
FROM centros c
WHERE lower(trim(e.centro_trabajo)) = lower(trim(c.nombre))
  AND e.centro_id IS NULL;

-- 3. employee_centro_history table
CREATE TABLE IF NOT EXISTS employee_centro_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  centro_id uuid REFERENCES centros(id) ON DELETE SET NULL,
  centro_nombre text NOT NULL DEFAULT '',
  fecha date NOT NULL DEFAULT current_date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE employee_centro_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_read_own_centro_history" ON employee_centro_history;
CREATE POLICY "employee_read_own_centro_history"
  ON employee_centro_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM empleados e WHERE e.id = employee_centro_history.empleado_id AND e.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_read_all_centro_history" ON employee_centro_history;
CREATE POLICY "staff_read_all_centro_history"
  ON employee_centro_history FOR SELECT
  TO authenticated
  USING (is_admin() OR is_prevencion() OR is_admin_or_rrhh());

DROP POLICY IF EXISTS "insert_centro_history_definer" ON employee_centro_history;
CREATE POLICY "insert_centro_history_definer"
  ON employee_centro_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. Add centro_id to prl_folders
DO $$ BEGIN
  ALTER TABLE prl_folders ADD COLUMN centro_id uuid REFERENCES centros(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 5. puesto_tags table
CREATE TABLE IF NOT EXISTS puesto_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE puesto_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_puesto_tags" ON puesto_tags;
CREATE POLICY "authenticated_select_puesto_tags"
  ON puesto_tags FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "prevencion_admin_manage_puesto_tags" ON puesto_tags;
CREATE POLICY "prevencion_admin_manage_puesto_tags"
  ON puesto_tags FOR ALL
  TO authenticated
  USING (is_admin() OR is_prevencion())
  WITH CHECK (is_admin() OR is_prevencion());

-- 6. prl_document_puesto_tags table
CREATE TABLE IF NOT EXISTS prl_document_puesto_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES prl_documents(id) ON DELETE CASCADE,
  puesto_tag_id uuid NOT NULL REFERENCES puesto_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(document_id, puesto_tag_id)
);

ALTER TABLE prl_document_puesto_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_prl_doc_puesto_tags" ON prl_document_puesto_tags;
CREATE POLICY "authenticated_select_prl_doc_puesto_tags"
  ON prl_document_puesto_tags FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "prevencion_admin_manage_prl_doc_puesto_tags" ON prl_document_puesto_tags;
CREATE POLICY "prevencion_admin_manage_prl_doc_puesto_tags"
  ON prl_document_puesto_tags FOR ALL
  TO authenticated
  USING (is_admin() OR is_prevencion())
  WITH CHECK (is_admin() OR is_prevencion());

-- 7. Seed common puesto tags
INSERT INTO puesto_tags (nombre) VALUES
  ('Psicologo'),
  ('Gerocultor'),
  ('Enfermero/a'),
  ('Auxiliar de Enfermeria'),
  ('Medico'),
  ('Trabajador Social'),
  ('Terapeuta Ocupacional'),
  ('Fisioterapeuta'),
  ('Educador'),
  ('Monitor'),
  ('Cocinero/a'),
  ('Limpieza'),
  ('Conductor'),
  ('Administrativo'),
  ('Mantenimiento')
ON CONFLICT (nombre) DO NOTHING;
