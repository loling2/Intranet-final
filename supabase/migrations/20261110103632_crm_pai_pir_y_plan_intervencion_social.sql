/*
# Tablas de planes PAI/PIR (Anexo II) y Plan de Intervención Social (IASS/SERCA)

1. New Tables
- `crm_pai_pir`: Programa de Atención Individual / Plan Individualizado de Rehabilitación (PG 00, Anexo II).
- `crm_plan_intervencion_social`: Plan de Intervención Social (IASS / SERCA).
Each table has:
  - `id` (uuid, primary key)
  - `usuario_servicio_id` (uuid, the resident/user, cascades on delete)
  - `estado` (text: borrador, activo, revisado, cerrado)
  - `fecha_elaboracion` (date, optional)
  - `datos` (jsonb, all form fields of that model, keyed by field name)
  - `creado_por_nombre` (text), `created_at`, `updated_at`

2. Security
- RLS enabled on both tables.
- Same access as the other CRM plan tables: any authenticated user can read, insert and update; only admin and rrhh can delete.

3. Notes
- Nothing is removed or altered in existing tables.
*/

CREATE TABLE IF NOT EXISTS crm_pai_pir (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'borrador',
  fecha_elaboracion date,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_por_nombre text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_plan_intervencion_social (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'borrador',
  fecha_elaboracion date,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_por_nombre text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_pai_pir_usuario ON crm_pai_pir(usuario_servicio_id);
CREATE INDEX IF NOT EXISTS idx_crm_plan_intervencion_social_usuario ON crm_plan_intervencion_social(usuario_servicio_id);

ALTER TABLE crm_pai_pir ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_plan_intervencion_social ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON crm_pai_pir TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm_plan_intervencion_social TO authenticated;

DROP POLICY IF EXISTS "crm_pai_pir_select" ON crm_pai_pir;
CREATE POLICY "crm_pai_pir_select" ON crm_pai_pir FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_pai_pir_insert" ON crm_pai_pir;
CREATE POLICY "crm_pai_pir_insert" ON crm_pai_pir FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_pai_pir_update" ON crm_pai_pir;
CREATE POLICY "crm_pai_pir_update" ON crm_pai_pir FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_pai_pir_delete" ON crm_pai_pir;
CREATE POLICY "crm_pai_pir_delete" ON crm_pai_pir FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin','rrhh')));

DROP POLICY IF EXISTS "crm_plan_intervencion_social_select" ON crm_plan_intervencion_social;
CREATE POLICY "crm_plan_intervencion_social_select" ON crm_plan_intervencion_social FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_plan_intervencion_social_insert" ON crm_plan_intervencion_social;
CREATE POLICY "crm_plan_intervencion_social_insert" ON crm_plan_intervencion_social FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_plan_intervencion_social_update" ON crm_plan_intervencion_social;
CREATE POLICY "crm_plan_intervencion_social_update" ON crm_plan_intervencion_social FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_plan_intervencion_social_delete" ON crm_plan_intervencion_social;
CREATE POLICY "crm_plan_intervencion_social_delete" ON crm_plan_intervencion_social FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin','rrhh')));
