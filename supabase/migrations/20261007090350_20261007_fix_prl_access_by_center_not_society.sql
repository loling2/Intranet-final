/*
# PRL access based on center and position, independent of society

## Purpose
Allow a worker to see PRL documents from a folder assigned to the worker's center even when the folder belongs to a different society.

## Visibility rules
1. The employee's current center or recorded center history is the primary folder access condition.
2. A center-linked folder is visible when its center matches one of those employee centers; its society is not used to block access.
3. Folder tags, department assignments, General folders, and unrestricted folders continue to work for folders without a center.
4. Documents with position tags remain limited to the employee's position, with `General` available to every employee who can access the folder.
5. Documents without position tags remain visible only inside an explicitly General folder.

## Modified database objects
- `public.get_my_prl_documents(uuid)` — removes the society equality restriction from folder access while preserving center and position filtering.
- `public.get_my_prl_documents()` — continues delegating to the user-specific version.

## Security
- The function remains `SECURITY DEFINER` with `search_path` fixed to `public`.
- Access remains server-enforced through the employee's current/history center and position; the frontend is not trusted for authorization.
- No tables, documents, storage objects, or RLS policies are changed.

## Important notes
1. This intentionally permits cross-society folders only when the folder is linked to a center assigned to the worker.
2. A worker does not receive every document from another society: the matching center and document puesto tag are still required.
3. Existing folder-tag and department-based access remains available for folders without a center.
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
  WHERE
    (
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
      EXISTS (
        SELECT 1
        FROM unnest(dpt.tags) tag_name
        WHERE lower(trim(tag_name)) = 'general'
      )
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