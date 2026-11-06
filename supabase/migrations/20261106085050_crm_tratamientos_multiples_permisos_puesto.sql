/*
# CRM: tratamientos múltiples por residente y permisos por puesto

## Cambios
1. Nueva tabla `crm_tratamientos`: varios tratamientos por residente.
   - Nombre, motivo, fecha de inicio, fecha de fin, estado ('en_proceso' o 'finalizado') y observaciones.
2. Nueva tabla `crm_tratamiento_medicaciones`: medicaciones de cada tratamiento.
   - Nombre, dosis, pauta (manana, tarde o noche) y orden.
3. Nueva tabla `crm_tratamiento_permisos`: nivel de acceso por puesto de trabajo y residente.
   - Nivel 'ver' (solo lectura) o 'editar' (ver, editar y borrar).
   - Sin fila = el puesto no ve los tratamientos de ese residente.
4. Función `get_crm_tratamiento_nivel(uuid)`: devuelve 'total' (admin/rrhh), 'editar', 'ver' o NULL para el usuario actual.

## Seguridad
- RLS activado en las tres tablas.
- Admin/RRHH: acceso completo y gestión de permisos.
- Profesionales: solo residentes asignados (crm_paciente_asignaciones) y según el nivel de su puesto.
- Solo admin/RRHH puede gestionar los permisos por puesto.

## Notas
- Migración idempotente (IF NOT EXISTS, DROP POLICY IF EXISTS).
- No modifica `crm_residente_tratamiento` ni sus documentos.
*/

CREATE TABLE IF NOT EXISTS crm_tratamientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  motivo text NOT NULL DEFAULT '',
  fecha_inicio date,
  fecha_fin date,
  estado text NOT NULL DEFAULT 'en_proceso' CHECK (estado IN ('en_proceso', 'finalizado')),
  observaciones text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_tratamiento_medicaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tratamiento_id uuid NOT NULL REFERENCES crm_tratamientos(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  dosis text NOT NULL DEFAULT '',
  pauta text NOT NULL CHECK (pauta IN ('manana', 'tarde', 'noche')),
  orden int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_tratamiento_permisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  puesto_tag_id uuid NOT NULL REFERENCES puesto_tags(id) ON DELETE CASCADE,
  nivel text NOT NULL CHECK (nivel IN ('ver', 'editar')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (usuario_servicio_id, puesto_tag_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_tratamientos_usuario ON crm_tratamientos (usuario_servicio_id);
CREATE INDEX IF NOT EXISTS idx_crm_tratamiento_medicaciones_tratamiento ON crm_tratamiento_medicaciones (tratamiento_id);
CREATE INDEX IF NOT EXISTS idx_crm_tratamiento_permisos_usuario ON crm_tratamiento_permisos (usuario_servicio_id);

CREATE OR REPLACE FUNCTION get_crm_tratamiento_nivel(p_usuario_servicio_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')) THEN 'total'
    WHEN NOT EXISTS (
      SELECT 1 FROM crm_paciente_asignaciones a
      WHERE a.usuario_servicio_id = p_usuario_servicio_id AND a.user_id = auth.uid()
    ) THEN NULL
    ELSE (
      SELECT p.nivel
      FROM crm_tratamiento_permisos p
      JOIN empleados e ON e.puesto_tag_id = p.puesto_tag_id
      WHERE p.usuario_servicio_id = p_usuario_servicio_id AND e.user_id = auth.uid()
      ORDER BY (p.nivel = 'editar') DESC
      LIMIT 1
    )
  END;
$$;

REVOKE EXECUTE ON FUNCTION get_crm_tratamiento_nivel FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_crm_tratamiento_nivel TO authenticated;

ALTER TABLE crm_tratamientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tratamiento_medicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tratamiento_permisos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON crm_tratamientos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm_tratamiento_medicaciones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm_tratamiento_permisos TO authenticated;

DROP POLICY IF EXISTS "crm_tratamientos_select" ON crm_tratamientos;
CREATE POLICY "crm_tratamientos_select" ON crm_tratamientos FOR SELECT TO authenticated
  USING (get_crm_tratamiento_nivel(usuario_servicio_id) IS NOT NULL);

DROP POLICY IF EXISTS "crm_tratamientos_insert" ON crm_tratamientos;
CREATE POLICY "crm_tratamientos_insert" ON crm_tratamientos FOR INSERT TO authenticated
  WITH CHECK (get_crm_tratamiento_nivel(usuario_servicio_id) IN ('total', 'editar'));

DROP POLICY IF EXISTS "crm_tratamientos_update" ON crm_tratamientos;
CREATE POLICY "crm_tratamientos_update" ON crm_tratamientos FOR UPDATE TO authenticated
  USING (get_crm_tratamiento_nivel(usuario_servicio_id) IN ('total', 'editar'))
  WITH CHECK (get_crm_tratamiento_nivel(usuario_servicio_id) IN ('total', 'editar'));

DROP POLICY IF EXISTS "crm_tratamientos_delete" ON crm_tratamientos;
CREATE POLICY "crm_tratamientos_delete" ON crm_tratamientos FOR DELETE TO authenticated
  USING (get_crm_tratamiento_nivel(usuario_servicio_id) IN ('total', 'editar'));

DROP POLICY IF EXISTS "crm_trat_med_select" ON crm_tratamiento_medicaciones;
CREATE POLICY "crm_trat_med_select" ON crm_tratamiento_medicaciones FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM crm_tratamientos t
    WHERE t.id = crm_tratamiento_medicaciones.tratamiento_id
      AND get_crm_tratamiento_nivel(t.usuario_servicio_id) IS NOT NULL
  ));

DROP POLICY IF EXISTS "crm_trat_med_insert" ON crm_tratamiento_medicaciones;
CREATE POLICY "crm_trat_med_insert" ON crm_tratamiento_medicaciones FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM crm_tratamientos t
    WHERE t.id = crm_tratamiento_medicaciones.tratamiento_id
      AND get_crm_tratamiento_nivel(t.usuario_servicio_id) IN ('total', 'editar')
  ));

DROP POLICY IF EXISTS "crm_trat_med_update" ON crm_tratamiento_medicaciones;
CREATE POLICY "crm_trat_med_update" ON crm_tratamiento_medicaciones FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM crm_tratamientos t
    WHERE t.id = crm_tratamiento_medicaciones.tratamiento_id
      AND get_crm_tratamiento_nivel(t.usuario_servicio_id) IN ('total', 'editar')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM crm_tratamientos t
    WHERE t.id = crm_tratamiento_medicaciones.tratamiento_id
      AND get_crm_tratamiento_nivel(t.usuario_servicio_id) IN ('total', 'editar')
  ));

DROP POLICY IF EXISTS "crm_trat_med_delete" ON crm_tratamiento_medicaciones;
CREATE POLICY "crm_trat_med_delete" ON crm_tratamiento_medicaciones FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM crm_tratamientos t
    WHERE t.id = crm_tratamiento_medicaciones.tratamiento_id
      AND get_crm_tratamiento_nivel(t.usuario_servicio_id) IN ('total', 'editar')
  ));

DROP POLICY IF EXISTS "crm_trat_perm_select" ON crm_tratamiento_permisos;
CREATE POLICY "crm_trat_perm_select" ON crm_tratamiento_permisos FOR SELECT TO authenticated
  USING (get_crm_tratamiento_nivel(usuario_servicio_id) IS NOT NULL);

DROP POLICY IF EXISTS "crm_trat_perm_insert" ON crm_tratamiento_permisos;
CREATE POLICY "crm_trat_perm_insert" ON crm_tratamiento_permisos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')));

DROP POLICY IF EXISTS "crm_trat_perm_update" ON crm_tratamiento_permisos;
CREATE POLICY "crm_trat_perm_update" ON crm_tratamiento_permisos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')));

DROP POLICY IF EXISTS "crm_trat_perm_delete" ON crm_tratamiento_permisos;
CREATE POLICY "crm_trat_perm_delete" ON crm_tratamiento_permisos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')));
