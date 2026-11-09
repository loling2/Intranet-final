/*
# CRM: asignación de empleados a coordinadores y de coordinadores a supervisores

## Resumen
- Nueva tabla crm_coordinador_empleados: qué empleados lleva cada coordinador.
- coordinador_supervisores: supervisores (gestores del CRM) pueden asignar y quitar coordinadores.

## Seguridad
- RLS en crm_coordinador_empleados: el coordinador lee sus filas; los gestores con permiso
  de Permisos leen y escriben.
- coordinador_supervisores: se amplían alta, baja y lectura a crm_puede_gestionar_permisos().
- Idempotente: IF NOT EXISTS y DROP POLICY IF EXISTS antes de cada CREATE POLICY.
*/

CREATE TABLE IF NOT EXISTS crm_coordinador_empleados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinador_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  empleado_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (coordinador_id, empleado_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_coordinador_empleados_coordinador ON crm_coordinador_empleados(coordinador_id);
CREATE INDEX IF NOT EXISTS idx_crm_coordinador_empleados_empleado ON crm_coordinador_empleados(empleado_id);

ALTER TABLE crm_coordinador_empleados ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON crm_coordinador_empleados TO authenticated;

DROP POLICY IF EXISTS "select_crm_coordinador_empleados" ON crm_coordinador_empleados;
CREATE POLICY "select_crm_coordinador_empleados" ON crm_coordinador_empleados FOR SELECT
  TO authenticated
  USING (coordinador_id = auth.uid() OR crm_puede_gestionar_permisos());

DROP POLICY IF EXISTS "insert_crm_coordinador_empleados" ON crm_coordinador_empleados;
CREATE POLICY "insert_crm_coordinador_empleados" ON crm_coordinador_empleados FOR INSERT
  TO authenticated
  WITH CHECK (crm_puede_gestionar_permisos());

DROP POLICY IF EXISTS "update_crm_coordinador_empleados" ON crm_coordinador_empleados;
CREATE POLICY "update_crm_coordinador_empleados" ON crm_coordinador_empleados FOR UPDATE
  TO authenticated
  USING (crm_puede_gestionar_permisos())
  WITH CHECK (crm_puede_gestionar_permisos());

DROP POLICY IF EXISTS "delete_crm_coordinador_empleados" ON crm_coordinador_empleados;
CREATE POLICY "delete_crm_coordinador_empleados" ON crm_coordinador_empleados FOR DELETE
  TO authenticated
  USING (crm_puede_gestionar_permisos());

DROP POLICY IF EXISTS "select_coordinador_supervisores" ON coordinador_supervisores;
CREATE POLICY "select_coordinador_supervisores" ON coordinador_supervisores FOR SELECT
  TO authenticated
  USING (is_admin_or_rrhh() OR coordinador_id = auth.uid() OR crm_puede_gestionar_permisos());

DROP POLICY IF EXISTS "insert_coordinador_supervisores" ON coordinador_supervisores;
CREATE POLICY "insert_coordinador_supervisores" ON coordinador_supervisores FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_rrhh() OR crm_puede_gestionar_permisos());

DROP POLICY IF EXISTS "delete_coordinador_supervisores" ON coordinador_supervisores;
CREATE POLICY "delete_coordinador_supervisores" ON coordinador_supervisores FOR DELETE
  TO authenticated
  USING (is_admin_or_rrhh() OR crm_puede_gestionar_permisos());
