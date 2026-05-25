/*
  # Añadir tag de acceso a prl_folders

  1. Cambios
    - Añade columna `access_tag_id` (uuid, nullable, FK a tags.id) a prl_folders
      - NULL = acceso libre para todos los usuarios de la sociedad
      - Con valor = solo pueden ver la carpeta y sus documentos los empleados que tengan ese tag asignado en `etiquetado`

  2. Seguridad RLS en prl_documents
    - Empleados (role = 'employee') solo ven documentos de carpetas cuyo access_tag_id:
        a) sea NULL (carpeta libre), o
        b) coincida con alguno de sus tags en `etiquetado`
    - Prevencion/Admin/RRHH ven todo

  Nota: prl_folders ya tiene RLS gestionada por políticas existentes.
  Aquí actualizamos las políticas de prl_documents para que filtren por tag de acceso.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prl_folders' AND column_name = 'access_tag_id'
  ) THEN
    ALTER TABLE prl_folders ADD COLUMN access_tag_id uuid REFERENCES tags(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Drop existing prl_documents select policy if any, recreate with tag filtering
DO $$
BEGIN
  -- Drop old generic select policies on prl_documents
  DROP POLICY IF EXISTS "allow_select_prl_documents" ON prl_documents;
  DROP POLICY IF EXISTS "authenticated can select prl_documents" ON prl_documents;
  DROP POLICY IF EXISTS "select prl_documents" ON prl_documents;
  DROP POLICY IF EXISTS "anon and authenticated can select prl_documents" ON prl_documents;
  DROP POLICY IF EXISTS "anyone can select prl_documents" ON prl_documents;
END $$;

-- New select policy: admin/rrhh/prevencion see all; employees only see docs in accessible folders
CREATE POLICY "prl_documents select with tag access control"
  ON prl_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'rrhh', 'prevencion')
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN prl_folders pf ON pf.id = prl_documents.folder_id
      WHERE up.id = auth.uid()
        AND up.role = 'employee'
        AND (
          pf.access_tag_id IS NULL
          OR EXISTS (
            SELECT 1 FROM etiquetado e
            WHERE e.entidad_id = up.id
              AND e.tag_id = pf.access_tag_id
          )
        )
    )
  );

-- Also ensure prl_folders select policy respects the same logic for employees
DO $$
BEGIN
  DROP POLICY IF EXISTS "allow_select_prl_folders" ON prl_folders;
  DROP POLICY IF EXISTS "authenticated can select prl_folders" ON prl_folders;
  DROP POLICY IF EXISTS "select prl_folders" ON prl_folders;
  DROP POLICY IF EXISTS "anon and authenticated can select prl_folders" ON prl_folders;
  DROP POLICY IF EXISTS "anyone can select prl_folders" ON prl_folders;
END $$;

CREATE POLICY "prl_folders select with tag access control"
  ON prl_folders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'rrhh', 'prevencion')
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'employee'
        AND (
          prl_folders.access_tag_id IS NULL
          OR EXISTS (
            SELECT 1 FROM etiquetado e
            WHERE e.entidad_id = up.id
              AND e.tag_id = prl_folders.access_tag_id
          )
        )
    )
  );
