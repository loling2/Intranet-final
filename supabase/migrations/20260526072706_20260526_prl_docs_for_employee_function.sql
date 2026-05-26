/*
  # Función SECURITY DEFINER para documentos PRL del empleado autenticado

  Crea una función que devuelve los documentos PRL accesibles para el empleado
  basándose en sus tags asignados a través de la tabla empleados.
  Usa SECURITY DEFINER para evitar los problemas de RLS intermedios.
*/

CREATE OR REPLACE FUNCTION get_my_prl_documents()
RETURNS TABLE (
  id uuid,
  nombre_archivo text,
  tipo text,
  created_at timestamptz,
  wasabi_key text,
  folder_id uuid,
  folder_nombre text
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
    f.nombre AS folder_nombre
  FROM prl_documents d
  JOIN prl_folders f ON f.id = d.folder_id
  WHERE
    -- carpeta sin restricción de tag
    f.access_tag_id IS NULL
    OR
    -- el empleado autenticado tiene el tag requerido por la carpeta
    EXISTS (
      SELECT 1
      FROM empleados emp
      JOIN etiquetado et ON et.entidad_id = emp.id
      WHERE emp.user_id = auth.uid()
        AND et.tag_id = f.access_tag_id
    )
  ORDER BY d.created_at DESC;
$$;

REVOKE ALL ON FUNCTION get_my_prl_documents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_prl_documents() TO authenticated;
