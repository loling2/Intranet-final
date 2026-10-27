/*
# Create additional treatment documents

1. New Tables
- `crm_tratamiento_documentos`
  - `id` (uuid, primary key)
  - `usuario_servicio_id` (uuid, resident reference)
  - `nombre_archivo` (text, original file name)
  - `wasabi_key` (text, private Wasabi object reference)
  - `tamano_bytes` (bigint, uploaded file size)
  - `uploaded_by` (uuid, authenticated uploader)
  - `created_at` (timestamptz, upload time)

2. Security
- Enable RLS on the table.
- Authenticated CRM users can read, upload, and update treatment attachments.
- Only admin and RRHH users can delete attachments.

3. Important Notes
- Files are stored under `crm/tratamiento/{usuario_servicio_id}/`.
- The table stores file metadata and the private storage reference only.
*/

CREATE TABLE IF NOT EXISTS crm_tratamiento_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL,
  nombre_archivo text NOT NULL,
  wasabi_key text NOT NULL,
  tamano_bytes bigint NOT NULL DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_tratamiento_documentos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm_tratamiento_documentos TO authenticated;

DROP POLICY IF EXISTS "crm_tratamiento_documentos_select" ON crm_tratamiento_documentos;
CREATE POLICY "crm_tratamiento_documentos_select" ON crm_tratamiento_documentos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "crm_tratamiento_documentos_insert" ON crm_tratamiento_documentos;
CREATE POLICY "crm_tratamiento_documentos_insert" ON crm_tratamiento_documentos FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "crm_tratamiento_documentos_update" ON crm_tratamiento_documentos;
CREATE POLICY "crm_tratamiento_documentos_update" ON crm_tratamiento_documentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "crm_tratamiento_documentos_delete" ON crm_tratamiento_documentos;
CREATE POLICY "crm_tratamiento_documentos_delete" ON crm_tratamiento_documentos FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = ANY (ARRAY['admin'::text, 'rrhh'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_crm_tratamiento_documentos_usuario ON crm_tratamiento_documentos(usuario_servicio_id);
