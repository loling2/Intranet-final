/*
  # Create PRL Download Logs table

  ## Purpose
  Track which employees have downloaded each PRL document to provide
  traceability for the Prevention team.

  ## New Tables
  - `prl_download_logs`
    - `id` (uuid, PK)
    - `document_id` (uuid) — references prl_documents
    - `user_id` (uuid) — auth user who downloaded
    - `empleado_id` (uuid) — empleado record
    - `downloaded_at` (timestamptz) — when it was downloaded

  ## Security
  - RLS enabled
  - Employees can INSERT their own logs and SELECT their own
  - Prevention role can SELECT all logs (via security definer helper)
*/

CREATE TABLE IF NOT EXISTS prl_download_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    uuid NOT NULL REFERENCES prl_documents(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL,
  empleado_id    uuid REFERENCES empleados(id) ON DELETE SET NULL,
  downloaded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prl_dl_document ON prl_download_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_prl_dl_user     ON prl_download_logs(user_id);

ALTER TABLE prl_download_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can insert own download logs"
  ON prl_download_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Employees can view own download logs"
  ON prl_download_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Prevencion can view all download logs"
  ON prl_download_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'prevencion')
    )
  );

/*
  Function: get_prl_document_trazabilidad(p_document_id uuid)
  Returns for each employee who SHOULD receive the document (via tag match),
  whether they have downloaded it and when.
*/
CREATE OR REPLACE FUNCTION public.get_prl_document_trazabilidad(p_document_id uuid)
RETURNS TABLE(
  empleado_id   uuid,
  nombre        text,
  email         text,
  society_id    uuid,
  society_nombre text,
  downloaded    boolean,
  downloaded_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    emp.id                           AS empleado_id,
    emp.nombre,
    emp.email,
    s.id                             AS society_id,
    s.nombre                         AS society_nombre,
    EXISTS (
      SELECT 1 FROM prl_download_logs dl
      WHERE dl.document_id = p_document_id
        AND dl.user_id = emp.user_id
    )                                AS downloaded,
    (
      SELECT MAX(dl.downloaded_at) FROM prl_download_logs dl
      WHERE dl.document_id = p_document_id
        AND dl.user_id = emp.user_id
    )                                AS downloaded_at
  FROM prl_documents d
  JOIN prl_folders f ON f.id = d.folder_id
  JOIN sociedades s  ON s.id = f.society_id
  -- employees in the same society
  JOIN empleados emp ON emp.id_sociedad::uuid = s.id
  -- tag match: if folder has access_tag, employee must have it
  WHERE d.id = p_document_id
    AND emp.user_id IS NOT NULL
    AND (
      f.access_tag_id IS NULL
      OR EXISTS (
        SELECT 1 FROM etiquetado et
        WHERE et.entidad_id = emp.id
          AND et.tag_id = f.access_tag_id
      )
    )
  ORDER BY downloaded DESC, emp.nombre;
$$;
