/*
# CRM: Documentos de usuarios de servicio (públicos y privados)

## Descripción
Añade almacenamiento de documentos asociados a cada usuario de servicio del CRM.
Los documentos pueden ser públicos (visibles para cualquier usuario con acceso al CRM)
o privados (visibles solo para supervisores y usuarios expresamente autorizados).

## Nuevas tablas

### crm_documentos
- `id` (uuid PK)
- `usuario_servicio_id` (uuid FK → usuarios_servicios, ON DELETE CASCADE)
- `titulo` (text, obligatorio)
- `descripcion` (text, opcional)
- `tipo` (text: 'publico' | 'privado', por defecto 'publico')
- `archivo_url` (text, URL del fichero en storage/Wasabi)
- `archivo_nombre` (text, nombre original del fichero)
- `subido_por` (text, nombre del autor que subió el documento)
- `created_at` (timestamptz)

### crm_documentos_autorizaciones
- `id` (uuid PK)
- `documento_id` (uuid FK → crm_documentos, ON DELETE CASCADE)
- `user_id` (uuid, referencia al user_profile autorizado a ver un documento privado)
- `created_at` (timestamptz)
- Unique (documento_id, user_id)

## Seguridad (RLS)
- SELECT de documentos públicos: cualquier usuario con rol admin/rrhh/supervisor puede verlos.
- SELECT de documentos privados: solo supervisores y usuarios con autorización explícita.
- INSERT/UPDATE/DELETE: solo admin y rrhh.
- crm_documentos_autorizaciones: SELECT para admin/rrhh/supervisor; INSERT/DELETE solo admin/rrhh.
*/

CREATE TABLE IF NOT EXISTS crm_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descripcion text DEFAULT '',
  tipo text NOT NULL DEFAULT 'publico' CHECK (tipo IN ('publico', 'privado')),
  archivo_url text DEFAULT '',
  archivo_nombre text DEFAULT '',
  subido_por text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crm_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_doc_select_staff" ON crm_documentos;
CREATE POLICY "crm_doc_select_staff" ON crm_documentos FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh','supervisor'))
  );

DROP POLICY IF EXISTS "crm_doc_insert_staff" ON crm_documentos;
CREATE POLICY "crm_doc_insert_staff" ON crm_documentos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  );

DROP POLICY IF EXISTS "crm_doc_update_staff" ON crm_documentos;
CREATE POLICY "crm_doc_update_staff" ON crm_documentos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  );

DROP POLICY IF EXISTS "crm_doc_delete_staff" ON crm_documentos;
CREATE POLICY "crm_doc_delete_staff" ON crm_documentos FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  );

-- Tabla de autorizaciones para documentos privados
CREATE TABLE IF NOT EXISTS crm_documentos_autorizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES crm_documentos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (documento_id, user_id)
);

ALTER TABLE crm_documentos_autorizaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_doc_auth_select_staff" ON crm_documentos_autorizaciones;
CREATE POLICY "crm_doc_auth_select_staff" ON crm_documentos_autorizaciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh','supervisor'))
  );

DROP POLICY IF EXISTS "crm_doc_auth_insert_staff" ON crm_documentos_autorizaciones;
CREATE POLICY "crm_doc_auth_insert_staff" ON crm_documentos_autorizaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  );

DROP POLICY IF EXISTS "crm_doc_auth_delete_staff" ON crm_documentos_autorizaciones;
CREATE POLICY "crm_doc_auth_delete_staff" ON crm_documentos_autorizaciones FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_crm_doc_usuario ON crm_documentos (usuario_servicio_id, tipo);
CREATE INDEX IF NOT EXISTS idx_crm_doc_auth_doc ON crm_documentos_autorizaciones (documento_id);

-- Función helper: obtener user_profiles para selector de autorizaciones
CREATE OR REPLACE FUNCTION get_crm_authorizable_users()
RETURNS TABLE (id uuid, nombre text, email text, role text)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, COALESCE(nombre, email), email, role
  FROM user_profiles
  WHERE role IN ('supervisor','rrhh','admin','prevencion')
    AND activo = true
  ORDER BY nombre;
$$;

REVOKE EXECUTE ON FUNCTION get_crm_authorizable_users FROM anon;
GRANT EXECUTE ON FUNCTION get_crm_authorizable_users TO authenticated;