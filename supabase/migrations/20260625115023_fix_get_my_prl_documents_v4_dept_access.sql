-- Update get_my_prl_documents: a folder is visible if the user matches via tag OR via prl department
DROP FUNCTION IF EXISTS public.get_my_prl_documents();

CREATE FUNCTION public.get_my_prl_documents()
RETURNS TABLE(
  id uuid,
  nombre_archivo text,
  tipo text,
  created_at timestamptz,
  wasabi_key text,
  folder_id uuid,
  folder_nombre text,
  society_id text,
  society_nombre text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT DISTINCT ON (d.id)
  d.id,
  d.nombre_archivo,
  d.tipo,
  d.created_at,
  d.wasabi_key,
  d.folder_id,
  f.nombre            AS folder_nombre,
  s.id::text          AS society_id,
  s.nombre            AS society_nombre
FROM prl_documents d
JOIN prl_folders f ON f.id = d.folder_id
JOIN sociedades s ON s.id = f.society_id
JOIN user_profiles up ON up.id = auth.uid()
WHERE
  -- Employee must belong to this society
  s.id::text = ANY(up.societies)
  AND (
    -- 1. Folder has no restrictions (no tags AND no departments) → open to all
    (
      NOT EXISTS (SELECT 1 FROM prl_folder_tags pft WHERE pft.folder_id = f.id)
      AND
      NOT EXISTS (SELECT 1 FROM prl_folder_departamentos pfd WHERE pfd.folder_id = f.id)
    )
    OR
    -- 2. Folder has tags → employee must have at least one matching tag
    EXISTS (
      SELECT 1
      FROM prl_folder_tags pft
      JOIN etiquetado et ON et.tag_id = pft.tag_id
      JOIN empleados emp ON emp.id = et.entidad_id AND emp.user_id = auth.uid()
      WHERE pft.folder_id = f.id
    )
    OR
    -- 3. Folder has departments → employee must be in at least one matching department
    EXISTS (
      SELECT 1
      FROM prl_folder_departamentos pfd
      JOIN empleados_departamentos_prl edp ON edp.departamento_prl_id = pfd.departamento_prl_id
      JOIN empleados emp ON emp.id = edp.empleado_id AND emp.user_id = auth.uid()
      WHERE pfd.folder_id = f.id
    )
  )
ORDER BY d.id, s.nombre, d.created_at DESC;
$$;
