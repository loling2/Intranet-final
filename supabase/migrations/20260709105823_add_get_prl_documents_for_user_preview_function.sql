-- Admin/prevencion function to preview PRL documents as a specific user
-- Only callable by users with admin or prevencion role
CREATE OR REPLACE FUNCTION get_prl_documents_for_user(target_user_id uuid)
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
SET search_path = public
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
JOIN user_profiles up ON up.id = target_user_id
-- Caller must be admin or prevencion
JOIN user_profiles caller ON caller.id = auth.uid() AND caller.role IN ('admin', 'prevencion')
WHERE
  s.id::text = ANY(up.societies)
  AND (
    EXISTS (
      SELECT 1
      FROM prl_folder_tags pft
      JOIN etiquetado et ON et.tag_id = pft.tag_id
      JOIN empleados emp ON emp.id = et.entidad_id AND emp.user_id = target_user_id
      WHERE pft.folder_id = f.id
    )
    OR
    EXISTS (
      SELECT 1
      FROM prl_folder_departamentos pfd
      JOIN empleados_departamentos_prl edp ON edp.departamento_prl_id = pfd.departamento_prl_id
      JOIN empleados emp ON emp.id = edp.empleado_id AND emp.user_id = target_user_id
      WHERE pfd.folder_id = f.id
    )
  )
ORDER BY d.id, s.nombre, d.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_prl_documents_for_user(uuid) TO authenticated;
