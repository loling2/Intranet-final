/*
  # Ampliar get_my_prl_documents para incluir sociedades por asignaciones

  El empleado puede pertenecer a una sociedad principal (empleados.id_sociedad)
  y adicionalmente estar asignado a centros de otras sociedades (asignaciones -> centros).
  La función devuelve documentos de todas las sociedades a las que el empleado pertenece,
  siempre que su tag coincida.
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
  SELECT DISTINCT ON (d.id)
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
    -- la carpeta pertenece a alguna sociedad del empleado:
    -- 1) sociedad principal del empleado
    -- 2) sociedad de los centros donde está asignado
    f.society_id IN (
      SELECT emp2.id_sociedad
      FROM empleados emp2
      WHERE emp2.user_id = auth.uid()
        AND emp2.id_sociedad IS NOT NULL
      UNION
      SELECT c.id_sociedad
      FROM asignaciones a
      JOIN centros c ON c.id = a.id_centro
      WHERE a.id_empleado = emp.id
        AND c.id_sociedad IS NOT NULL
    )
    AND (
      -- sin restricción de tag
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
  ORDER BY d.id, d.created_at DESC;
$$;

REVOKE ALL ON FUNCTION get_my_prl_documents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_prl_documents() TO authenticated;
