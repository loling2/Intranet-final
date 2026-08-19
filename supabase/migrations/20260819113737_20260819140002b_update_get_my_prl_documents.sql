/*
# Update get_my_prl_documents: filter by employee centros + puesto tags

## Summary
Drops and recreates `get_my_prl_documents` to return additional columns
(folder_centro_id, folder_centro_nombre, puesto_tags) and filter by the
employee's centers (current + historical) and matching puesto tags.
*/

DROP FUNCTION IF EXISTS public.get_my_prl_documents();

CREATE FUNCTION public.get_my_prl_documents()
RETURNS TABLE(
  id uuid,
  nombre_archivo text,
  tipo text,
  created_at timestamp with time zone,
  wasabi_key text,
  folder_id uuid,
  folder_nombre text,
  society_id text,
  society_nombre text,
  folder_centro_id uuid,
  folder_centro_nombre text,
  puesto_tags text[]
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH my_empleado AS (
  SELECT e.id AS emp_id, e.puesto AS emp_puesto, e.centro_id AS emp_centro_id
  FROM empleados e
  WHERE e.user_id = auth.uid()
  LIMIT 1
),
my_centros AS (
  SELECT emp_centro_id AS centro_id FROM my_empleado WHERE emp_centro_id IS NOT NULL
  UNION
  SELECT ech.centro_id
  FROM employee_centro_history ech, my_empleado me
  WHERE ech.empleado_id = me.emp_id AND ech.centro_id IS NOT NULL
),
doc_puesto_tags AS (
  SELECT pdpt.document_id, array_agg(pt.nombre) AS tags
  FROM prl_document_puesto_tags pdpt
  JOIN puesto_tags pt ON pt.id = pdpt.puesto_tag_id
  GROUP BY pdpt.document_id
)
SELECT DISTINCT ON (d.id)
  d.id,
  d.nombre_archivo,
  d.tipo,
  d.created_at,
  d.wasabi_key,
  d.folder_id,
  f.nombre AS folder_nombre,
  s.id::text AS society_id,
  s.nombre AS society_nombre,
  f.centro_id AS folder_centro_id,
  COALESCE(c.nombre, '') AS folder_centro_nombre,
  COALESCE(dpt.tags, ARRAY[]::text[]) AS puesto_tags
FROM prl_documents d
JOIN prl_folders f ON f.id = d.folder_id
JOIN sociedades s ON s.id = f.society_id
LEFT JOIN centros c ON c.id = f.centro_id
LEFT JOIN doc_puesto_tags dpt ON dpt.document_id = d.id,
my_empleado me
WHERE
  (f.centro_id IS NULL OR f.centro_id IN (SELECT centro_id FROM my_centros))
  AND
  (
    EXISTS (
      SELECT 1 FROM prl_folder_tags pft
      JOIN etiquetado et ON et.tag_id = pft.tag_id
      WHERE pft.folder_id = f.id AND et.entidad_id = me.emp_id
    )
    OR
    EXISTS (
      SELECT 1 FROM prl_folder_departamentos pfd
      JOIN empleados_departamentos_prl edp ON edp.departamento_prl_id = pfd.departamento_prl_id
      WHERE pfd.folder_id = f.id AND edp.empleado_id = me.emp_id
    )
    OR
    (NOT EXISTS (SELECT 1 FROM prl_folder_tags pft2 WHERE pft2.folder_id = f.id)
     AND NOT EXISTS (SELECT 1 FROM prl_folder_departamentos pfd2 WHERE pfd2.folder_id = f.id))
  )
  AND
  (
    dpt.tags IS NULL
    OR (me.emp_puesto IS NOT NULL AND me.emp_puesto = ANY(dpt.tags))
    OR NOT EXISTS (SELECT 1 FROM prl_document_puesto_tags pdpt2 WHERE pdpt2.document_id = d.id)
  )
ORDER BY d.id, s.nombre, d.created_at DESC;
$function$;
