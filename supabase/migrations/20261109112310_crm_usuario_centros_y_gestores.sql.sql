/*
# CRM: centros asignados a trabajadores y coordinadores

## Resumen
Permite asignar uno o varios centros de trabajo a cada usuario del CRM (trabajador
o coordinador). Un usuario sólo verá los residentes de los centros que tenga asignados.
Los gestores (admin, rrhh y supervisor) son quienes hacen estas asignaciones y
también quienes modifican los permisos de pestañas por puesto.

## 1. Nueva tabla: crm_usuario_centros
- `user_id` -> user_profiles(id): trabajador o coordinador.
- `centro_id` -> centros(id).
- UNIQUE (user_id, centro_id).
- No se rellena automáticamente: las asignaciones las hace un gestor.

## 2. Nueva función: crm_es_gestor()
- Verdadero si el usuario firmado es admin, rrhh o supervisor (por rol principal o lista de roles).

## 3. Políticas
- crm_usuario_centros: cada usuario puede leer sus propias filas; los gestores leen, crean,
  modifican y borran cualquiera.
- crm_perfil_pestanas: escritura ampliada de admin/rrhh a gestores (incluye supervisor).

## Seguridad
- RLS activado en crm_usuario_centros, una política por operación.
- crm_es_gestor se revoca de PUBLIC y anon, y se concede a authenticated.
- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE POLICY.
*/

CREATE TABLE IF NOT EXISTS crm_usuario_centros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  centro_id uuid NOT NULL REFERENCES centros(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, centro_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_usuario_centros_user ON crm_usuario_centros(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_usuario_centros_centro ON crm_usuario_centros(centro_id);

ALTER TABLE crm_usuario_centros ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.crm_es_gestor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.user_profiles
  WHERE id = auth.uid()
  AND (
    role IN ('admin', 'rrhh', 'supervisor')
    OR roles && ARRAY['admin', 'rrhh', 'supervisor']::text[]
  )
);
$$;

REVOKE EXECUTE ON FUNCTION public.crm_es_gestor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_es_gestor() TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON crm_usuario_centros TO authenticated;

DROP POLICY IF EXISTS "select_crm_usuario_centros" ON crm_usuario_centros;
CREATE POLICY "select_crm_usuario_centros" ON crm_usuario_centros FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR crm_es_gestor());

DROP POLICY IF EXISTS "insert_crm_usuario_centros" ON crm_usuario_centros;
CREATE POLICY "insert_crm_usuario_centros" ON crm_usuario_centros FOR INSERT
  TO authenticated
  WITH CHECK (crm_es_gestor());

DROP POLICY IF EXISTS "update_crm_usuario_centros" ON crm_usuario_centros;
CREATE POLICY "update_crm_usuario_centros" ON crm_usuario_centros FOR UPDATE
  TO authenticated
  USING (crm_es_gestor())
  WITH CHECK (crm_es_gestor());

DROP POLICY IF EXISTS "delete_crm_usuario_centros" ON crm_usuario_centros;
CREATE POLICY "delete_crm_usuario_centros" ON crm_usuario_centros FOR DELETE
  TO authenticated
  USING (crm_es_gestor());

DROP POLICY IF EXISTS "insert_crm_perfil_pestanas" ON crm_perfil_pestanas;
CREATE POLICY "insert_crm_perfil_pestanas" ON crm_perfil_pestanas FOR INSERT
  TO authenticated
  WITH CHECK (crm_es_gestor());

DROP POLICY IF EXISTS "update_crm_perfil_pestanas" ON crm_perfil_pestanas;
CREATE POLICY "update_crm_perfil_pestanas" ON crm_perfil_pestanas FOR UPDATE
  TO authenticated
  USING (crm_es_gestor())
  WITH CHECK (crm_es_gestor());

DROP POLICY IF EXISTS "delete_crm_perfil_pestanas" ON crm_perfil_pestanas;
CREATE POLICY "delete_crm_perfil_pestanas" ON crm_perfil_pestanas FOR DELETE
  TO authenticated
  USING (crm_es_gestor());
