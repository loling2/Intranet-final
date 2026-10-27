/*
# Create crm_pai_documentos table for PAI/PIE PDF attachments

1. New Tables
- `crm_pai_documentos`
  - `id` (uuid, primary key, auto-generated)
  - `pai_id` (uuid, foreign key to crm_pai.id, ON DELETE CASCADE so removing a plan removes its documents)
  - `nombre_archivo` (text, original PDF filename shown in UI)
  - `wasabi_key` (text, full Wasabi object key used for download/preview)
  - `tamano_bytes` (bigint, file size for display)
  - `uploaded_by` (uuid, the auth user who uploaded the file)
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `crm_pai_documentos`.
- Grant SELECT, INSERT, UPDATE, DELETE to `authenticated` (the CRM app requires sign-in).
- SELECT policy: any authenticated user can read (matches parent crm_pai select policy which is `true`).
- INSERT policy: any authenticated user can insert (matches parent crm_pai insert policy).
- UPDATE policy: any authenticated user can update (matches parent crm_pai update policy).
- DELETE policy: only admin/rrhh roles can delete (matches parent crm_pai delete policy).

3. Important Notes
- Files are stored in Wasabi under the `crm/pai/{pai_id}/` prefix; this table only stores references.
- Deleting a PAI plan cascades to its document rows, but Wasabi objects must be cleaned up separately by the app when a document row is deleted.
*/

CREATE TABLE IF NOT EXISTS crm_pai_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pai_id uuid NOT NULL REFERENCES crm_pai(id) ON DELETE CASCADE,
  nombre_archivo text NOT NULL,
  wasabi_key text NOT NULL,
  tamano_bytes bigint NOT NULL DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crm_pai_documentos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON crm_pai_documentos TO authenticated;

DROP POLICY IF EXISTS "crm_pai_documentos_select" ON crm_pai_documentos;
CREATE POLICY "crm_pai_documentos_select"
ON crm_pai_documentos FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "crm_pai_documentos_insert" ON crm_pai_documentos;
CREATE POLICY "crm_pai_documentos_insert"
ON crm_pai_documentos FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "crm_pai_documentos_update" ON crm_pai_documentos;
CREATE POLICY "crm_pai_documentos_update"
ON crm_pai_documentos FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "crm_pai_documentos_delete" ON crm_pai_documentos;
CREATE POLICY "crm_pai_documentos_delete"
ON crm_pai_documentos FOR DELETE
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['admin'::text, 'rrhh'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_crm_pai_documentos_pai_id ON crm_pai_documentos(pai_id);
