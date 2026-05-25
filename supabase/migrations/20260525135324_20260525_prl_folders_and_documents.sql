/*
  # PRL Folders and Documents

  Tablas dedicadas a la gestion de documentacion PRL.

  1. prl_folders  — carpetas creadas por prevencion/admin
  2. prl_documents — archivos subidos dentro de cada carpeta (con referencia a Wasabi)

  Security: solo prevencion y admin (via is_prevencion / is_admin_or_rrhh) pueden operar.
*/

CREATE TABLE IF NOT EXISTS prl_folders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL,
  descripcion  text DEFAULT '',
  society_id   uuid NOT NULL,
  created_by   uuid,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE prl_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prevencion and admin can select prl_folders"
  ON prl_folders FOR SELECT TO authenticated
  USING (is_admin_or_rrhh() OR is_prevencion());

CREATE POLICY "prevencion and admin can insert prl_folders"
  ON prl_folders FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_rrhh() OR is_prevencion());

CREATE POLICY "prevencion and admin can update prl_folders"
  ON prl_folders FOR UPDATE TO authenticated
  USING (is_admin_or_rrhh() OR is_prevencion())
  WITH CHECK (is_admin_or_rrhh() OR is_prevencion());

CREATE POLICY "prevencion and admin can delete prl_folders"
  ON prl_folders FOR DELETE TO authenticated
  USING (is_admin_or_rrhh() OR is_prevencion());

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prl_documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id         uuid NOT NULL REFERENCES prl_folders(id) ON DELETE CASCADE,
  nombre_archivo    text NOT NULL,
  wasabi_key        text NOT NULL,
  tipo              text DEFAULT '',
  tamano_bytes      bigint DEFAULT 0,
  subido_por        uuid,
  subido_por_nombre text DEFAULT '',
  society_id        uuid NOT NULL,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE prl_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prevencion and admin can select prl_documents"
  ON prl_documents FOR SELECT TO authenticated
  USING (is_admin_or_rrhh() OR is_prevencion());

CREATE POLICY "prevencion and admin can insert prl_documents"
  ON prl_documents FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_rrhh() OR is_prevencion());

CREATE POLICY "prevencion and admin can update prl_documents"
  ON prl_documents FOR UPDATE TO authenticated
  USING (is_admin_or_rrhh() OR is_prevencion())
  WITH CHECK (is_admin_or_rrhh() OR is_prevencion());

CREATE POLICY "prevencion and admin can delete prl_documents"
  ON prl_documents FOR DELETE TO authenticated
  USING (is_admin_or_rrhh() OR is_prevencion());

CREATE INDEX IF NOT EXISTS prl_documents_folder_id_idx ON prl_documents(folder_id);
CREATE INDEX IF NOT EXISTS prl_documents_society_id_idx ON prl_documents(society_id);
CREATE INDEX IF NOT EXISTS prl_folders_society_id_idx ON prl_folders(society_id);
