/*
# Create calidad_documentos table and add "calidad" role

1. Purpose
   - Stores metadata for documents uploaded by the "calidad" role.
   - Documents can be "general" (visible to all societies) or "per-society" (visible only to selected societies).
   - Files are stored in Wasabi under: calidad/<año>/<mes>/<filename>

2. New Tables
   - `calidad_documentos`
     - `id` (uuid, primary key)
     - `nombre_archivo` (text, original file name)
     - `wasabi_key` (text, full S3 key path in Wasabi)
     - `tipo` (text, MIME type)
     - `tamano_bytes` (bigint, file size)
     - `es_general` (boolean, true = visible to all societies, false = per-society)
     - `sociedad_ids` (text[], array of society IDs that can see this doc)
     - `anio` (text, year of the folder)
     - `mes` (text, month of the folder)
     - `subido_por` (uuid, user who uploaded)
     - `subido_por_nombre` (text, name of uploader)
     - `created_at` (timestamptz)

3. Role
   - Adds "calidad" to app_roles table.

4. Security
   - Enable RLS on `calidad_documentos`.
   - SELECT: anon/authenticated can see general docs or docs for their society.
   - INSERT/UPDATE/DELETE: authenticated users can manage.
*/
CREATE TABLE IF NOT EXISTS calidad_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_archivo text NOT NULL,
  wasabi_key text NOT NULL,
  tipo text,
  tamano_bytes bigint,
  es_general boolean NOT NULL DEFAULT false,
  sociedad_ids text[] DEFAULT '{}',
  anio text NOT NULL,
  mes text NOT NULL,
  subido_por uuid,
  subido_por_nombre text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE calidad_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_calidad_documentos" ON calidad_documentos;
CREATE POLICY "select_calidad_documentos" ON calidad_documentos FOR SELECT
TO anon, authenticated
USING (
  es_general = true
  OR sociedad_ids = '{}'
  OR EXISTS (
    SELECT 1 FROM empleados e
    WHERE e.user_id = auth.uid()
    AND e.id_sociedad::text = ANY(calidad_documentos.sociedad_ids)
  )
  OR EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role IN ('admin', 'calidad')
  )
);

DROP POLICY IF EXISTS "insert_calidad_documentos" ON calidad_documentos;
CREATE POLICY "insert_calidad_documentos" ON calidad_documentos FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "update_calidad_documentos" ON calidad_documentos;
CREATE POLICY "update_calidad_documentos" ON calidad_documentos FOR UPDATE
TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_calidad_documentos" ON calidad_documentos;
CREATE POLICY "delete_calidad_documentos" ON calidad_documentos FOR DELETE
TO authenticated
USING (true);

INSERT INTO app_roles (name, description)
SELECT 'calidad', 'Calidad - subida y gestion de documentos de calidad'
WHERE NOT EXISTS (SELECT 1 FROM app_roles WHERE name = 'calidad');
