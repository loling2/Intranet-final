/*
# CRM: Incidencias de residentes

## Cambios
1. Nueva tabla `crm_incidencias`:
   - Registra incidencias de residentes (pacientes) por centro.
   - Campos: usuario_servicio_id, centro_id, titulo, descripcion, estado (pendiente/urgente/resuelta), prioridad, fecha, fecha_resolucion, creado_por.
   - Estados: pendiente (amarillo), urgente (rojo), resuelta (verde).
2. RLS:
   - Admin/RRHH: acceso completo.
   - Profesionales: ven incidencias de residentes que tienen asignados.
3. Índices en usuario_servicio_id, centro_id, estado, fecha.
*/

CREATE TABLE IF NOT EXISTS crm_incidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  centro_id uuid REFERENCES centros(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descripcion text DEFAULT '',
  estado text NOT NULL DEFAULT 'pendiente',
  prioridad text NOT NULL DEFAULT 'normal',
  fecha timestamptz NOT NULL DEFAULT now(),
  fecha_resolucion timestamptz,
  creado_por_id uuid,
  creado_por_nombre text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE crm_incidencias ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_crm_inc_usuario ON crm_incidencias (usuario_servicio_id);
CREATE INDEX IF NOT EXISTS idx_crm_inc_centro ON crm_incidencias (centro_id);
CREATE INDEX IF NOT EXISTS idx_crm_inc_estado ON crm_incidencias (estado);
CREATE INDEX IF NOT EXISTS idx_crm_inc_fecha ON crm_incidencias (fecha);

-- Admin/RRHH: acceso completo
DROP POLICY IF EXISTS "crm_inc_select_staff" ON crm_incidencias;
CREATE POLICY "crm_inc_select_staff" ON crm_incidencias FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
    OR EXISTS (
      SELECT 1 FROM crm_paciente_asignaciones a
      WHERE a.usuario_servicio_id = crm_incidencias.usuario_servicio_id
      AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "crm_inc_insert_staff" ON crm_incidencias;
CREATE POLICY "crm_inc_insert_staff" ON crm_incidencias FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
    OR EXISTS (
      SELECT 1 FROM crm_paciente_asignaciones a
      WHERE a.usuario_servicio_id = crm_incidencias.usuario_servicio_id
      AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "crm_inc_update_staff" ON crm_incidencias;
CREATE POLICY "crm_inc_update_staff" ON crm_incidencias FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
    OR EXISTS (
      SELECT 1 FROM crm_paciente_asignaciones a
      WHERE a.usuario_servicio_id = crm_incidencias.usuario_servicio_id
      AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
    OR EXISTS (
      SELECT 1 FROM crm_paciente_asignaciones a
      WHERE a.usuario_servicio_id = crm_incidencias.usuario_servicio_id
      AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "crm_inc_delete_staff" ON crm_incidencias;
CREATE POLICY "crm_inc_delete_staff" ON crm_incidencias FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')));