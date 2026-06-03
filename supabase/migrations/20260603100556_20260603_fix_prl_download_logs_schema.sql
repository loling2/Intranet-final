/*
  # Fix PRL Download Logs and Trazabilidad RPC

  ## Problems Fixed
  1. prl_download_logs table has different schema than expected (missing 'downloaded' column, has 'user_id' instead)
  2. get_prl_document_trazabilidad() RPC uses wrong column names

  ## Changes
  - Add 'downloaded' boolean column to prl_download_logs (it was missing)
  - Fix the RPC function to match actual table schema
  - Also add 'create_at' default properly
*/

-- Add missing 'downloaded' column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prl_download_logs' AND column_name = 'downloaded'
  ) THEN
    ALTER TABLE prl_download_logs ADD COLUMN downloaded boolean DEFAULT false;
  END IF;
END $$;

-- Add created_at if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prl_download_logs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE prl_download_logs ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Fix the RPC function to use correct column names and proper logic
CREATE OR REPLACE FUNCTION get_prl_document_trazabilidad(p_document_id uuid)
RETURNS TABLE (
  empleado_id uuid,
  nombre text,
  email text,
  society_id uuid,
  society_nombre text,
  downloaded boolean,
  downloaded_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    e.id,
    e.nombre,
    e.email,
    e.id_sociedad,
    s.nombre,
    CASE WHEN pdl.downloaded_at IS NOT NULL THEN true ELSE false END,
    pdl.downloaded_at
  FROM empleados e
  LEFT JOIN sociedades s ON e.id_sociedad = s.id
  LEFT JOIN prl_download_logs pdl
    ON e.id = pdl.empleado_id
    AND pdl.document_id = p_document_id
  WHERE e.activo = true
    AND EXISTS (
      SELECT 1
      FROM prl_documents pd
      JOIN prl_folders pf ON pd.folder_id = pf.id
      LEFT JOIN etiquetado et
        ON et.entidad_id = e.id
        AND et.tag_id = pf.access_tag_id
      WHERE pd.id = p_document_id
        AND (pf.access_tag_id IS NULL OR et.id IS NOT NULL)
    )
  ORDER BY e.nombre;
$$;
