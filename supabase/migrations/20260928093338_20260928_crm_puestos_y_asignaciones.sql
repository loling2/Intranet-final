/*
# CRM: alinear documentos con puestos de empleados y asignaciones de pacientes

## Cambios
1. `crm_carpetas`:
   - Nueva columna `puesto_tag_id` (uuid, FK a puesto_tags, nullable). NULL = carpeta "General".
   - `categoria_id` ahora nullable (obsoleto, se mantiene por compatibilidad).
2. Nueva tabla `crm_paciente_asignaciones`:
   - Vincula cada paciente (usuarios_servicios) con un profesional (auth user).
   - Un profesional solo ve los pacientes que tiene asignados.
3. RLS actualizada:
   - `usuarios_servicios`: profesionales ven solo sus pacientes asignados; admin/rrhh ven todos.
   - `crm_notas`: profesionales ven y crean notas solo de sus pacientes asignados.
   - `crm_carpetas`: un profesional ve carpetas de sus pacientes donde el puesto coincide con el suyo (o es General).
4. Funciones actualizadas:
   - `can_access_crm()`, `get_my_crm_categorias()`, `get_visible_crm_carpetas()`.
   - Nuevas: `get_my_crm_pacientes()`, `get_crm_profesionales()`.
*/

ALTER TABLE crm_carpetas ADD COLUMN IF NOT EXISTS puesto_tag_id uuid
  REFERENCES puesto_tags(id) ON DELETE SET NULL;
ALTER TABLE crm_carpetas ALTER COLUMN categoria_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS crm_paciente_asignaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  puesto_tag_id uuid REFERENCES puesto_tags(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (usuario_servicio_id, user_id)
);

ALTER TABLE crm_paciente_asignaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_asig_select_auth" ON crm_paciente_asignaciones;
CREATE POLICY "crm_asig_select_auth" ON crm_paciente_asignaciones FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "crm_asig_insert_staff" ON crm_paciente_asignaciones;
CREATE POLICY "crm_asig_insert_staff" ON crm_paciente_asignaciones FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  );

DROP POLICY IF EXISTS "crm_asig_delete_staff" ON crm_paciente_asignaciones;
CREATE POLICY "crm_asig_delete_staff" ON crm_paciente_asignaciones FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  );

CREATE INDEX IF NOT EXISTS idx_crm_asig_paciente ON crm_paciente_asignaciones (usuario_servicio_id);
CREATE INDEX IF NOT EXISTS idx_crm_asig_user ON crm_paciente_asignaciones (user_id);

-- usuarios_servicios: profesionales ven solo sus pacientes
DROP POLICY IF EXISTS "usuarios_servicios_select_staff" ON usuarios_servicios;
CREATE POLICY "usuarios_servicios_select_staff" ON usuarios_servicios FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
    OR EXISTS (
      SELECT 1 FROM crm_paciente_asignaciones a
      WHERE a.usuario_servicio_id = usuarios_servicios.id AND a.user_id = auth.uid()
    )
  );

-- crm_notas: profesionales ven y crean notas de sus pacientes
DROP POLICY IF EXISTS "crm_notas_select_staff" ON crm_notas;
CREATE POLICY "crm_notas_select_staff" ON crm_notas FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
    OR EXISTS (
      SELECT 1 FROM crm_paciente_asignaciones a
      WHERE a.usuario_servicio_id = crm_notas.usuario_servicio_id AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "crm_notas_insert_staff" ON crm_notas;
CREATE POLICY "crm_notas_insert_staff" ON crm_notas FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
    OR EXISTS (
      SELECT 1 FROM crm_paciente_asignaciones a
      WHERE a.usuario_servicio_id = crm_notas.usuario_servicio_id AND a.user_id = auth.uid()
    )
  );

-- crm_carpetas: profesionales ven carpetas de sus pacientes por puesto
DROP POLICY IF EXISTS "crm_carpetas_select_auth" ON crm_carpetas;
CREATE POLICY "crm_carpetas_select_auth" ON crm_carpetas FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
    OR (
      crm_carpetas.puesto_tag_id IS NULL
      AND EXISTS (
        SELECT 1 FROM crm_paciente_asignaciones a
        WHERE a.usuario_servicio_id = crm_carpetas.usuario_servicio_id
        AND a.user_id = auth.uid()
      )
    )
    OR (
      crm_carpetas.puesto_tag_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM empleados e
        WHERE e.user_id = auth.uid()
        AND e.puesto_tag_id = crm_carpetas.puesto_tag_id
      )
      AND EXISTS (
        SELECT 1 FROM crm_paciente_asignaciones a
        WHERE a.usuario_servicio_id = crm_carpetas.usuario_servicio_id
        AND a.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "crm_carpetas_insert_staff" ON crm_carpetas;
CREATE POLICY "crm_carpetas_insert_staff" ON crm_carpetas FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  );

DROP POLICY IF EXISTS "crm_carpetas_update_staff" ON crm_carpetas;
CREATE POLICY "crm_carpetas_update_staff" ON crm_carpetas FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')));

DROP POLICY IF EXISTS "crm_carpetas_delete_staff" ON crm_carpetas;
CREATE POLICY "crm_carpetas_delete_staff" ON crm_carpetas FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')));

-- Funciones
CREATE OR REPLACE FUNCTION can_access_crm()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
    OR
    EXISTS (SELECT 1 FROM crm_paciente_asignaciones WHERE user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION can_access_crm FROM anon;
GRANT EXECUTE ON FUNCTION can_access_crm TO authenticated;

CREATE OR REPLACE FUNCTION get_my_crm_categorias()
RETURNS TABLE (id uuid, nombre text, es_general boolean)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT NULL::uuid AS id, 'General'::text AS nombre, true AS es_general
  UNION
  SELECT pt.id AS id, pt.nombre AS nombre, false AS es_general
  FROM puesto_tags pt
  WHERE EXISTS (
    SELECT 1 FROM empleados e
    WHERE e.user_id = auth.uid() AND e.puesto_tag_id = pt.id
  )
  ORDER BY es_general DESC, nombre;
$$;

REVOKE EXECUTE ON FUNCTION get_my_crm_categorias FROM anon;
GRANT EXECUTE ON FUNCTION get_my_crm_categorias TO authenticated;

CREATE OR REPLACE FUNCTION get_visible_crm_carpetas(p_usuario_servicio_id uuid)
RETURNS TABLE (
  id uuid,
  usuario_servicio_id uuid,
  categoria_id uuid,
  nombre text,
  wasabi_prefix text,
  categoria_nombre text,
  es_general boolean,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    car.id, car.usuario_servicio_id, car.categoria_id, car.nombre,
    car.wasabi_prefix,
    COALESCE(pt.nombre, 'General') AS categoria_nombre,
    (car.puesto_tag_id IS NULL) AS es_general,
    car.created_at
  FROM crm_carpetas car
  LEFT JOIN puesto_tags pt ON pt.id = car.puesto_tag_id
  WHERE car.usuario_servicio_id = p_usuario_servicio_id
    AND (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
      OR (
        car.puesto_tag_id IS NULL
        AND EXISTS (
          SELECT 1 FROM crm_paciente_asignaciones a
          WHERE a.usuario_servicio_id = p_usuario_servicio_id AND a.user_id = auth.uid()
        )
      )
      OR (
        car.puesto_tag_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM empleados e
          WHERE e.user_id = auth.uid() AND e.puesto_tag_id = car.puesto_tag_id
        )
        AND EXISTS (
          SELECT 1 FROM crm_paciente_asignaciones a
          WHERE a.usuario_servicio_id = p_usuario_servicio_id AND a.user_id = auth.uid()
        )
      )
    )
  ORDER BY (car.puesto_tag_id IS NULL) DESC, categoria_nombre, car.nombre;
$$;

REVOKE EXECUTE ON FUNCTION get_visible_crm_carpetas FROM anon;
GRANT EXECUTE ON FUNCTION get_visible_crm_carpetas TO authenticated;

CREATE OR REPLACE FUNCTION get_my_crm_pacientes()
RETURNS TABLE (
  id uuid,
  nombre text,
  apellidos text,
  email text,
  telefono text,
  observaciones text,
  activo boolean
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    us.id, us.nombre, us.apellidos, us.email, us.telefono,
    us.observaciones, us.activo
  FROM usuarios_servicios us
  WHERE
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
    OR EXISTS (
      SELECT 1 FROM crm_paciente_asignaciones a
      WHERE a.usuario_servicio_id = us.id AND a.user_id = auth.uid()
    )
  ORDER BY us.nombre, us.apellidos;
$$;

REVOKE EXECUTE ON FUNCTION get_my_crm_pacientes FROM anon;
GRANT EXECUTE ON FUNCTION get_my_crm_pacientes TO authenticated;

CREATE OR REPLACE FUNCTION get_crm_profesionales()
RETURNS TABLE (
  user_id uuid,
  nombre text,
  email text,
  puesto text,
  puesto_tag_id uuid
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT
    e.user_id,
    COALESCE(e.nombre || ' ' || e.apellidos, e.nombre, up.nombre, '') AS nombre,
    up.email,
    COALESCE(e.puesto, pt.nombre, '') AS puesto,
    e.puesto_tag_id
  FROM empleados e
  LEFT JOIN user_profiles up ON up.id = e.user_id
  LEFT JOIN puesto_tags pt ON pt.id = e.puesto_tag_id
  WHERE e.user_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  ORDER BY nombre;
$$;

REVOKE EXECUTE ON FUNCTION get_crm_profesionales FROM anon;
GRANT EXECUTE ON FUNCTION get_crm_profesionales TO authenticated;