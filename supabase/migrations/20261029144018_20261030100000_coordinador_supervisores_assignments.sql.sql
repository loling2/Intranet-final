/*
# Coordinador: supervisor assignments and read-only panel

## 1. Role
- Adds `coordinador` to app_roles so user_profiles.role can use it.

## 2. New table: coordinador_supervisores
- `coordinador_id` (uuid) -> user_profiles(id), the coordinator.
- `supervisor_id` (uuid) -> user_profiles(id), the supervisor they review.
- UNIQUE (coordinador_id, supervisor_id).
- RLS: admin/rrhh manage all rows; a coordinator can read only its own rows.

## 3. New function: get_coordinador_panel()
- Returns, for the signed-in coordinator only, each assigned supervisor with
  their centros and the employees in their scope (get_supervisor_empleados).
- Read-only. Uses auth.uid(), so no argument is accepted.

## Security
- RLS enabled on coordinador_supervisores, one policy per verb.
- get_coordinador_panel is revoked from PUBLIC and anon, granted to authenticated.
*/

INSERT INTO app_roles (name, description)
VALUES ('coordinador', 'Revisa a los supervisores asignados')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS coordinador_supervisores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinador_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  supervisor_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (coordinador_id, supervisor_id)
);

CREATE INDEX IF NOT EXISTS idx_coordinador_supervisores_coordinador ON coordinador_supervisores(coordinador_id);
CREATE INDEX IF NOT EXISTS idx_coordinador_supervisores_supervisor ON coordinador_supervisores(supervisor_id);

ALTER TABLE coordinador_supervisores ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON coordinador_supervisores TO authenticated;

DROP POLICY IF EXISTS "select_coordinador_supervisores" ON coordinador_supervisores;
CREATE POLICY "select_coordinador_supervisores" ON coordinador_supervisores FOR SELECT
  TO authenticated
  USING (is_admin_or_rrhh() OR coordinador_id = auth.uid());

DROP POLICY IF EXISTS "insert_coordinador_supervisores" ON coordinador_supervisores;
CREATE POLICY "insert_coordinador_supervisores" ON coordinador_supervisores FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_rrhh());

DROP POLICY IF EXISTS "update_coordinador_supervisores" ON coordinador_supervisores;
CREATE POLICY "update_coordinador_supervisores" ON coordinador_supervisores FOR UPDATE
  TO authenticated
  USING (is_admin_or_rrhh())
  WITH CHECK (is_admin_or_rrhh());

DROP POLICY IF EXISTS "delete_coordinador_supervisores" ON coordinador_supervisores;
CREATE POLICY "delete_coordinador_supervisores" ON coordinador_supervisores FOR DELETE
  TO authenticated
  USING (is_admin_or_rrhh());

CREATE OR REPLACE FUNCTION get_coordinador_panel()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(sup ORDER BY sup->>'nombre'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', up.id,
      'nombre', up.nombre,
      'email', up.email,
      'centros', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre) ORDER BY c.nombre)
        FROM supervisor_centros sc
        JOIN centros c ON c.id = sc.centro_id
        WHERE sc.supervisor_id = up.id
      ), '[]'::jsonb),
      'empleados', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', e.id,
          'nombre', e.nombre,
          'apellidos', e.apellidos,
          'puesto', e.puesto,
          'centro_trabajo', e.centro_trabajo,
          'activo', e.activo
        ) ORDER BY e.nombre)
        FROM empleados e
        WHERE e.id IN (SELECT empleado_id FROM get_supervisor_empleados(up.id))
      ), '[]'::jsonb)
    ) AS sup
    FROM coordinador_supervisores cs
    JOIN user_profiles up ON up.id = cs.supervisor_id
    WHERE cs.coordinador_id = auth.uid()
  ) t;
$$;

REVOKE EXECUTE ON FUNCTION get_coordinador_panel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_coordinador_panel() TO authenticated;
