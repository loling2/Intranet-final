/*
  # Fix get_my_prl_documents to respect user's assigned societies (v2)

  Cast s.id to text for comparison against user_profiles.societies (text[]).
*/

CREATE OR REPLACE FUNCTION public.get_my_prl_documents()
RETURNS TABLE(
  id uuid,
  nombre_archivo text,
  tipo text,
  created_at timestamptz,
  wasabi_key text,
  folder_id uuid,
  folder_nombre text,
  society_id uuid,
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
  f.nombre   AS folder_nombre,
  s.id       AS society_id,
  s.nombre   AS society_nombre
FROM prl_documents d
JOIN prl_folders f ON f.id = d.folder_id
JOIN sociedades s ON s.id = f.society_id
JOIN empleados emp ON emp.user_id = auth.uid()
JOIN user_profiles up ON up.id = auth.uid()
WHERE
  s.id::text = ANY(up.societies)
  AND (
    f.access_tag_id IS NULL
    OR EXISTS (
      SELECT 1 FROM etiquetado et
      WHERE et.entidad_id = emp.id
        AND et.tag_id = f.access_tag_id
    )
  )
ORDER BY d.id, s.nombre, d.created_at DESC;
$$;
