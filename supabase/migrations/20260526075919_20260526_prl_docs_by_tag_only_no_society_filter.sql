/*
  # Rework get_my_prl_documents: filtrar solo por tag, sin restriccion de sociedad

  El empleado ve documentos de CUALQUIER sociedad cuya carpeta tenga un tag
  que el empleado posea (o sin tag). Se devuelve la sociedad de la carpeta
  para que el frontend pueda agrupar por empresa.

  Esto permite que el prevencionista suba docs bajo cualquier sociedad y
  el empleado los vea si tiene el tag correspondiente.
*/

DROP FUNCTION IF EXISTS get_my_prl_documents();

CREATE FUNCTION get_my_prl_documents()
RETURNS TABLE (
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
SECURITY DEFINER
STABLE
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
  WHERE
    f.access_tag_id IS NULL
    OR EXISTS (
      SELECT 1 FROM etiquetado et
      WHERE et.entidad_id = emp.id
        AND et.tag_id = f.access_tag_id
    )
  ORDER BY d.id, s.nombre, d.created_at DESC;
$$;

REVOKE ALL ON FUNCTION get_my_prl_documents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_prl_documents() TO authenticated;
