/*
# Fix: PRL documents visibility for manually assigned centers and untagged documents

## Summary
Two fixes to `get_my_prl_documents` so employees assigned to a center
(e.g. "Oficina Eleda") can see the Prevencion documents of that center's folder.

## Problem 1 — Manual center assignments were ignored
When an admin assigns an employee to a center from the employee detail panel,
the assignment is stored in the `asignaciones` table (id_empleado + id_centro).
The function only considered `empleados.centro_id` (current center) and
`employee_centro_history` (past centers), so manual assignments never granted
access to the center's PRL folders.

### Change
Added a third branch to the `my_centros` CTE that reads `asignaciones`
for the employee, so a manual center assignment now grants access to the
folders of that center (same rule as current and historical centers).

## Problem 2 — Documents without job-position sub-tags were hidden
The UI (PuestoTagModal) promises: "Sin sub-tag = visible para todos los que
ya tienen acceso a la carpeta". The function instead required, for documents
with no sub-tags, that the folder be tagged 'general'. In a folder tagged
with a center name (e.g. "Eleda"), the ~15 of 18 documents without sub-tags
were invisible even to employees with access.

### Change
The final WHERE filter now treats documents with no job-position sub-tags
(`dpt.tags IS NULL`) as visible to anyone who already has access to the
folder, regardless of the folder's access tag. Documents WITH sub-tags keep
the existing rule: visible if a sub-tag is 'General' or matches the
employee's job position (case-insensitive).

## Modified objects
- `public.get_my_prl_documents(p_user_id uuid DEFAULT NULL)` — recreated with
  the same signature, columns, LANGUAGE sql / STABLE / SECURITY DEFINER /
  `SET search_path TO 'public'`; only the two logic changes above.

## Security
- No change to EXECUTE grants; the function keeps its SECURITY DEFINER owner
  and `search_path` pinning.
- Access remains scoped to the calling user (`COALESCE(p_user_id, auth.uid())`
  resolved against `empleados.user_id`); no new data becomes public.

## Notes
1. Idempotent: `CREATE OR REPLACE FUNCTION` with identical signature.
2. No tables, columns, grants or policies are modified; no data is touched.
*/

CREATE OR REPLACE FUNCTION public.get_my_prl_documents(p_user_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, nombre_archivo text, tipo text, created_at timestamp with time zone, wasabi_key text, folder_id uuid, folder_nombre text, society_id text, society_nombre text, folder_centro_id uuid, folder_centro_nombre text, puesto_tags text[])
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
  UNION
  SELECT a.id_centro
  FROM public.asignaciones a
  JOIN my_empleado me ON me.emp_id = a.id_empleado
  WHERE a.id_centro IS NOT NULL
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
  OR dpt.tags IS NULL
ORDER BY d.id, d.created_at DESC;
$function$;
