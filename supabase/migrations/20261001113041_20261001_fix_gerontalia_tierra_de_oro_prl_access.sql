/*
# Fix Gerontalia Tierra de Oro PRL access

## Purpose
Ensure employees assigned to the Tierra de Oro center receive the PRL documents stored in the Gerontalia Tierra de Oro folder.

## Data correction
- Links the existing Gerontalia `TIERRA DE ORO` PRL folder to the existing `TIERRA DE ORO` center.
- No documents are deleted or moved.

## Access behavior
- A matching employee center grants access to the folder's documents.
- Document position tags remain respected when present.
- Position comparison is case-insensitive and ignores spaces around the value.
- Documents without position tags remain available when the employee has access to the folder by center.

## Security
- No RLS policies are changed.
- The existing SECURITY DEFINER function and access rules remain in place.
*/

UPDATE public.prl_folders f
SET centro_id = c.id
FROM public.centros c
WHERE f.society_id = '6632d8d1-c4e7-4540-aab7-515b9d7913f7'
  AND lower(trim(f.nombre)) = 'tierra de oro'
  AND c.id_sociedad = f.society_id
  AND lower(trim(c.nombre)) = 'tierra de oro'
  AND f.centro_id IS NULL;

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
  SELECT e.id AS emp_id, e.puesto AS emp_puesto, e.centro_id AS emp_centro_id, e.id_sociedad AS emp_sociedad_id
  FROM empleados e
  WHERE e.user_id = COALESCE(p_user_id, auth.uid())
  LIMIT 1
),
my_centros AS (
  SELECT emp_centro_id AS centro_id
  FROM my_empleado
  WHERE emp_centro_id IS NOT NULL
  UNION
  SELECT ech.centro_id
  FROM employee_centro_history ech, my_empleado me
  WHERE ech.empleado_id = me.emp_id
    AND ech.centro_id IS NOT NULL
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
  COALESCE(emp_s.id::text, s.id::text) AS society_id,
  COALESCE(emp_s.nombre, s.nombre) AS society_nombre,
  f.centro_id AS folder_centro_id,
  COALESCE(c.nombre, '') AS folder_centro_nombre,
  COALESCE(dpt.tags, ARRAY[]::text[]) AS puesto_tags
FROM prl_documents d
JOIN prl_folders f ON f.id = d.folder_id
JOIN sociedades s ON s.id = f.society_id
LEFT JOIN centros c ON c.id = f.centro_id
LEFT JOIN doc_puesto_tags dpt ON dpt.document_id = d.id,
my_empleado me
LEFT JOIN sociedades emp_s ON emp_s.id = me.emp_sociedad_id
WHERE
  (f.centro_id IS NULL OR f.centro_id IN (SELECT centro_id FROM my_centros))
  AND (
    (f.centro_id IS NOT NULL AND f.centro_id IN (SELECT centro_id FROM my_centros))
    OR EXISTS (
      SELECT 1
      FROM prl_folder_tags pft
      JOIN etiquetado et ON et.tag_id = pft.tag_id
      WHERE pft.folder_id = f.id
        AND et.entidad_id = me.emp_id
    )
    OR EXISTS (
      SELECT 1
      FROM prl_folder_departamentos pfd
      JOIN empleados_departamentos_prl edp ON edp.departamento_prl_id = pfd.departamento_prl_id
      WHERE pfd.folder_id = f.id
        AND edp.empleado_id = me.emp_id
    )
    OR EXISTS (
      SELECT 1
      FROM prl_folder_tags pft
      JOIN tags t ON t.id = pft.tag_id
      WHERE pft.folder_id = f.id
        AND lower(trim(t.nombre)) = 'general'
    )
    OR (
      NOT EXISTS (SELECT 1 FROM prl_folder_tags pft2 WHERE pft2.folder_id = f.id)
      AND NOT EXISTS (SELECT 1 FROM prl_folder_departamentos pfd2 WHERE pfd2.folder_id = f.id)
    )
  )
  AND (
    dpt.tags IS NULL
    OR dpt.tags && ARRAY['General']::text[]
    OR (
      NOT dpt.tags && ARRAY['General']::text[]
      AND me.emp_puesto IS NOT NULL
      AND lower(trim(me.emp_puesto)) = ANY (SELECT lower(trim(t)) FROM unnest(dpt.tags) t)
    )
  )
ORDER BY d.id, COALESCE(emp_s.nombre, s.nombre), d.created_at DESC;
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
