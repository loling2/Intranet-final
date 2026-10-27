/*
# Create documents for resident benefits

1. New Tables
- `crm_prestaciones_documentos`
  - `id` (uuid, primary key)
  - `usuario_servicio_id` (uuid, resident reference)
  - `nombre_archivo` (text, original document name)
  - `wasabi_key` (text, private Wasabi object key)
  - `tamano_bytes` (bigint, uploaded file size)
  - `uploaded_by` (uuid, authenticated uploader)
  - `created_at` (timestamptz, upload time)

2. Security
- Enable RLS and grant CRUD access to authenticated CRM users.
- Read, insert, and update rules match the existing CRM resident tables.
- Delete is limited to admin and RRHH users.

3. Important Notes
- Files are stored under `crm/prestaciones/{usuario_servicio_id}/`.
- The database stores metadata and the private Wasabi reference, not file contents.
*/

CREATE TABLE IF NOT EXISTS crm_prestaciones_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL,
  nombre_archivo text NOT NULL,
  wasabi_key text NOT NULL,
  tamano_bytes bigint NOT NULL DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_prestaciones_documentos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm_prestaciones_documentos TO authenticated;

DROP POLICY IF EXISTS "crm_prestaciones_documentos_select" ON crm_prestaciones_documentos;
CREATE POLICY "crm_prestaciones_documentos_select" ON crm_prestaciones_documentos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "crm_prestaciones_documentos_insert" ON crm_prestaciones_documentos;
CREATE POLICY "crm_prestaciones_documentos_insert" ON crm_prestaciones_documentos FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "crm_prestaciones_documentos_update" ON crm_prestaciones_documentos;
CREATE POLICY "crm_prestaciones_documentos_update" ON crm_prestaciones_documentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "crm_prestaciones_documentos_delete" ON crm_prestaciones_documentos;
CREATE POLICY "crm_prestaciones_documentos_delete" ON crm_prestaciones_documentos FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = ANY (ARRAY['admin'::text, 'rrhh'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_crm_prestaciones_documentos_usuario ON crm_prestaciones_documentos(usuario_servicio_id);
