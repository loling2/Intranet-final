/*
# Tablas de planes de atención por modelo (PAI residencia, PAI SPAP domicilio, Plan de Atención y Vida)

1. New Tables
- `crm_pai_residencia`: plan PAI (Anexo II) para personas residentes en centro.
- `crm_pai_spap`: plan PAI SPAP para servicio de domicilio.
- `crm_plan_vida`: Plan de Atención y Vida (modelo AICP).
Each table has:
  - `id` (uuid, primary key)
  - `usuario_servicio_id` (uuid, the resident/user, cascades on delete)
  - `estado` (text: borrador, activo, revisado, cerrado)
  - `fecha_elaboracion` (date, optional)
  - `datos` (jsonb, all form fields of that model, keyed by field name)
  - `creado_por_nombre` (text), `created_at`, `updated_at`

2. Security
- RLS enabled on all three tables.
- Same access as the existing crm_pai table: any authenticated user can read, insert and update; only admin and rrhh can delete.

3. Notes
- Nothing is removed or altered in existing tables. The legacy crm_pai table is untouched.
*/

CREATE TABLE IF NOT EXISTS crm_pai_residencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'borrador',
  fecha_elaboracion date,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_por_nombre text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_pai_spap (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'borrador',
  fecha_elaboracion date,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_por_nombre text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_plan_vida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'borrador',
  fecha_elaboracion date,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_por_nombre text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_pai_residencia_usuario ON crm_pai_residencia(usuario_servicio_id);
CREATE INDEX IF NOT EXISTS idx_crm_pai_spap_usuario ON crm_pai_spap(usuario_servicio_id);
CREATE INDEX IF NOT EXISTS idx_crm_plan_vida_usuario ON crm_plan_vida(usuario_servicio_id);

ALTER TABLE crm_pai_residencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_pai_spap ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_plan_vida ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON crm_pai_residencia TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm_pai_spap TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm_plan_vida TO authenticated;

DROP POLICY IF EXISTS "crm_pai_residencia_select" ON crm_pai_residencia;
CREATE POLICY "crm_pai_residencia_select" ON crm_pai_residencia FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_pai_residencia_insert" ON crm_pai_residencia;
CREATE POLICY "crm_pai_residencia_insert" ON crm_pai_residencia FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_pai_residencia_update" ON crm_pai_residencia;
CREATE POLICY "crm_pai_residencia_update" ON crm_pai_residencia FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_pai_residencia_delete" ON crm_pai_residencia;
CREATE POLICY "crm_pai_residencia_delete" ON crm_pai_residencia FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin','rrhh')));

DROP POLICY IF EXISTS "crm_pai_spap_select" ON crm_pai_spap;
CREATE POLICY "crm_pai_spap_select" ON crm_pai_spap FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_pai_spap_insert" ON crm_pai_spap;
CREATE POLICY "crm_pai_spap_insert" ON crm_pai_spap FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_pai_spap_update" ON crm_pai_spap;
CREATE POLICY "crm_pai_spap_update" ON crm_pai_spap FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_pai_spap_delete" ON crm_pai_spap;
CREATE POLICY "crm_pai_spap_delete" ON crm_pai_spap FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin','rrhh')));

DROP POLICY IF EXISTS "crm_plan_vida_select" ON crm_plan_vida;
CREATE POLICY "crm_plan_vida_select" ON crm_plan_vida FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_plan_vida_insert" ON crm_plan_vida;
CREATE POLICY "crm_plan_vida_insert" ON crm_plan_vida FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_plan_vida_update" ON crm_plan_vida;
CREATE POLICY "crm_plan_vida_update" ON crm_plan_vida FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_plan_vida_delete" ON crm_plan_vida;
CREATE POLICY "crm_plan_vida_delete" ON crm_plan_vida FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin','rrhh')));
