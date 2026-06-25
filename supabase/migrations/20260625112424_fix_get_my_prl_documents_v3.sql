-- Drop and recreate get_my_prl_documents with corrected multi-tag logic and text society_id
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
  s.id::text = ANY(up.societies)
  AND (
    NOT EXISTS (
      SELECT 1 FROM prl_folder_tags pft WHERE pft.folder_id = f.id
    )
    OR
    EXISTS (
      SELECT 1
      FROM prl_folder_tags pft
      JOIN etiquetado et ON et.tag_id = pft.tag_id
      JOIN empleados emp ON emp.id = et.entidad_id AND emp.user_id = auth.uid()
      WHERE pft.folder_id = f.id
    )
  )
ORDER BY d.id, s.nombre, d.created_at DESC;
$$;
