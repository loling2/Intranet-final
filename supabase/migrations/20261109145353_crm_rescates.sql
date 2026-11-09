-- CRM: registro de rescates
--
-- 1. Nueva tabla crm_rescates: un registro por cada vez que se usa un rescate con un residente.
--    usuario_servicio_id (residente), fecha_hora, metodo ('quimico', 'fuerza_fisica', 'ambos'),
--    medicacion, dosis, descripcion, registrado_por (uuid, automatico) y registrado_por_nombre.
-- 2. Seguridad: RLS activado. Lectura para cualquier nivel con acceso a Tratamientos del residente
--    ('total', 'editar', 'ver'). Alta solo para 'total' y 'editar'. Sin UPDATE ni DELETE.
-- 3. Migracion idempotente (IF NOT EXISTS, DROP POLICY IF EXISTS).

CREATE TABLE IF NOT EXISTS crm_rescates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  fecha_hora timestamptz NOT NULL DEFAULT now(),
  metodo text NOT NULL CHECK (metodo IN ('quimico', 'fuerza_fisica', 'ambos')),
  medicacion text NOT NULL DEFAULT '',
  dosis text NOT NULL DEFAULT '',
  descripcion text NOT NULL,
  registrado_por uuid DEFAULT auth.uid(),
  registrado_por_nombre text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_rescates_usuario ON crm_rescates (usuario_servicio_id);
CREATE INDEX IF NOT EXISTS idx_crm_rescates_fecha ON crm_rescates (fecha_hora);

ALTER TABLE crm_rescates ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON crm_rescates TO authenticated;

DROP POLICY IF EXISTS "crm_rescates_select" ON crm_rescates;
CREATE POLICY "crm_rescates_select" ON crm_rescates FOR SELECT TO authenticated
  USING (get_crm_tratamiento_nivel(usuario_servicio_id) IS NOT NULL);

DROP POLICY IF EXISTS "crm_rescates_insert" ON crm_rescates;
CREATE POLICY "crm_rescates_insert" ON crm_rescates FOR INSERT TO authenticated
  WITH CHECK (get_crm_tratamiento_nivel(usuario_servicio_id) IN ('total', 'editar'));
