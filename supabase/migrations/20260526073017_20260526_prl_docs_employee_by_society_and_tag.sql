/*
  # Corregir función get_my_prl_documents para filtrar por sociedad + tag

  El empleado pertenece a una sociedad (empleados.id_sociedad).
  Las carpetas PRL pertenecen a una sociedad (prl_folders.society_id).
  El empleado solo debe ver documentos de carpetas cuya sociedad coincida
  con la suya Y cuyo access_tag_id coincida con uno de sus tags (o sea null).
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
  folder_society_id uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    d.id,
    d.nombre_archivo,
    d.tipo,
    d.created_at,
    d.wasabi_key,
    d.folder_id,
    f.nombre AS folder_nombre,
    f.society_id AS folder_society_id
  FROM prl_documents d
  JOIN prl_folders f ON f.id = d.folder_id
  JOIN empleados emp ON emp.user_id = auth.uid()
  WHERE
    -- la carpeta pertenece a la misma sociedad que el empleado
    f.society_id = emp.id_sociedad
    AND (
      -- carpeta sin restricción de tag
      f.access_tag_id IS NULL
      OR
      -- el empleado tiene el tag requerido
      EXISTS (
        SELECT 1
        FROM etiquetado et
        WHERE et.entidad_id = emp.id
          AND et.tag_id = f.access_tag_id
      )
    )
  ORDER BY d.created_at DESC;
$$;

REVOKE ALL ON FUNCTION get_my_prl_documents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_prl_documents() TO authenticated;
