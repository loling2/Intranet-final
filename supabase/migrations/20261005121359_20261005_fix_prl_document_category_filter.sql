/*
# Fix PRL document visibility by society, center, and position

## Purpose
Ensure each worker sees only the PRL documents intended for their society, current center, and position category.

## Visibility rules
1. A document must belong to the worker's society.
2. A folder with a center is visible only when the worker's current center or recorded center history matches that center.
3. A folder without a center is visible only when its folder access tag, department, General tag, or intentionally unrestricted configuration grants access.
4. A document with position tags is visible only when one of those tags matches the worker's position, or the document is explicitly tagged `General`.
5. A document without position tags is visible only when it is in a folder explicitly marked with the `General` tag.

## Security
- Keeps SECURITY DEFINER and the fixed public search_path.
- Does not change tables, documents, storage objects, or RLS policies.
- The optional user ID is retained for the admin employee-view screen.
*/

CREATE OR REPLACE FUNCTION public.get_my_prl_documents(p_user_id uuid DEFAULT NULL)
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
  SELECT e.id AS emp_id,
         e.puesto AS emp_puesto,
         e.centro_id AS emp_centro_id,
         e.id_sociedad AS emp_sociedad_id
  FROM public.empleados e
  WHERE e.user_id = COALESCE(p_user_id, auth.uid())
  LIMIT 1
),
my_centros AS (
  SELECT me.emp_centro_id AS centro_id
  FROM my_empleado me
  WHERE me.emp_centro_id IS NOT NULL
  UNION
  SELECT ech.centro_id
  FROM public.employee_centro_history ech
  JOIN my_empleado me ON me.emp_id = ech.empleado_id
  WHERE ech.centro_id IS NOT NULL
),
doc_puesto_tags AS (
  SELECT pdpt.document_id,
         array_agg(pt.nombre ORDER BY pt.nombre) AS tags
  FROM public.prl_document_puesto_tags pdpt
  JOIN public.puesto_tags pt ON pt.id = pdpt.puesto_tag_id
  GROUP BY pdpt.document_id
),
accessible_folders AS (
  SELECT f.id,
         EXISTS (
           SELECT 1
           FROM public.prl_folder_tags pft
           JOIN public.tags t ON t.id = pft.tag_id
           WHERE pft.folder_id = f.id
             AND lower(trim(t.nombre)) = 'general'
         ) AS is_general_folder
  FROM public.prl_folders f
  CROSS JOIN my_empleado me
  WHERE f.society_id = me.emp_sociedad_id
    AND (
      (f.centro_id IS NOT NULL AND f.centro_id IN (SELECT centro_id FROM my_centros))
      OR EXISTS (
        SELECT 1
        FROM public.prl_folder_tags pft
        JOIN public.etiquetado et ON et.tag_id = pft.tag_id
        WHERE pft.folder_id = f.id
          AND et.entidad_id = me.emp_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.prl_folder_departamentos pfd
        JOIN public.empleados_departamentos_prl edp ON edp.departamento_prl_id = pfd.departamento_prl_id
        WHERE pfd.folder_id = f.id
          AND edp.empleado_id = me.emp_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.prl_folder_tags pft
        JOIN public.tags t ON t.id = pft.tag_id
        WHERE pft.folder_id = f.id
          AND lower(trim(t.nombre)) = 'general'
      )
      OR (
        f.centro_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.prl_folder_tags pft2 WHERE pft2.folder_id = f.id)
        AND NOT EXISTS (SELECT 1 FROM public.prl_folder_departamentos pfd2 WHERE pfd2.folder_id = f.id)
      )
    )
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
FROM public.prl_documents d
JOIN public.prl_folders f ON f.id = d.folder_id
JOIN accessible_folders af ON af.id = f.id
JOIN public.sociedades s ON s.id = f.society_id
CROSS JOIN my_empleado me
LEFT JOIN public.centros c ON c.id = f.centro_id
LEFT JOIN doc_puesto_tags dpt ON dpt.document_id = d.id
WHERE
  (
    dpt.tags IS NOT NULL
    AND (
      dpt.tags && ARRAY['General']::text[]
      OR (
        me.emp_puesto IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM unnest(dpt.tags) tag_name
          WHERE lower(trim(tag_name)) = lower(trim(me.emp_puesto))
        )
      )
    )
  )
  OR (
    dpt.tags IS NULL
    AND af.is_general_folder
  )
ORDER BY d.id, d.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_prl_documents()
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
SELECT * FROM public.get_my_prl_documents(auth.uid());
$function$;
