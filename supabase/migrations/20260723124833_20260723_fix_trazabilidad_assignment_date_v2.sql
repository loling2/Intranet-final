/*
# Fix PRL Trazabilidad: Real Assignment Date + ISO Format

## Summary
Updates the `get_prl_trazabilidad_stats` RPC function so that the "fecha de asignación"
shown for pending documents reflects the REAL date a document was assigned to a worker
(via tag or department), NOT the document's creation/upload date.

## Changes
1. **Assignment date computation**: The `emp_doc` CTE now computes `assignment_date`
   for each employee-document pair:
   - If the document was assigned via **tags** (`etiquetado` table): uses
     `etiquetado.created_at` (the date the tag was assigned to the employee).
   - If the document was assigned via **departments** (`empleados_departamentos_prl`):
     uses `empleados_departamentos_prl.created_at` (the date the employee joined the dept).
   - If matched via multiple paths (tags + departments): takes the EARLIEST date.
   - If matched via **society fallback** (folder has no tags/departments): falls back
     to `prl_documents.created_at` (document upload date) as the assignment date.
2. **Date format fix**: Replaces the non-standard `to_char(..., 'YYYY-MM-DD"T"HH24:MI:SSOF')`
   with `assignment_date::text`, which produces a format JavaScript's `new Date()` parses
   reliably (e.g., `2024-01-15 10:30:00+00`).
3. **Idempotent**: Drops all existing overloads before recreating the single canonical version.

## Tables Affected
- No tables created or modified — only the `get_prl_trazabilidad_stats` function is replaced.

## Security
- Function remains `SECURITY DEFINER`, `STABLE`, `LANGUAGE sql`.
- No RLS policy changes.
*/

-- Drop all existing overloads to ensure a single canonical version
DROP FUNCTION IF EXISTS public.get_prl_trazabilidad_stats(text, text);
DROP FUNCTION IF EXISTS public.get_prl_trazabilidad_stats(text, text, uuid);
DROP FUNCTION IF EXISTS public.get_prl_trazabilidad_stats();

-- Recreate with real assignment date computation
CREATE OR REPLACE FUNCTION public.get_prl_trazabilidad_stats(
  p_society_id  text DEFAULT NULL,
  p_centro      text DEFAULT NULL,
  p_empleado_id uuid DEFAULT NULL
)
RETURNS TABLE(
  empleado_id       uuid,
  nombre            text,
  email             text,
  society_id        text,
  society_nombre    text,
  centro_trabajo    text,
  total_asignados   bigint,
  total_descargados bigint,
  total_pendientes  bigint,
  docs_pendientes   jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH docs AS (
  SELECT pd.id AS doc_id, pd.nombre_archivo, pd.created_at AS doc_created_at,
         pf.id AS folder_id, pf.society_id AS folder_society_id, pf.nombre AS folder_nombre
  FROM prl_documents pd
  JOIN prl_folders pf ON pf.id = pd.folder_id
  WHERE (p_society_id IS NULL OR pf.society_id::text = p_society_id)
),
emps AS (
  SELECT e.id AS emp_id, e.nombre AS emp_nombre, COALESCE(e.email,'') AS emp_email,
         COALESCE(e.id_sociedad::text,'') AS emp_society_id, COALESCE(e.centro_trabajo,'') AS emp_centro
  FROM empleados e
  WHERE e.activo = true
    AND (p_society_id IS NULL OR e.id_sociedad::text = p_society_id)
    AND (p_centro IS NULL OR p_centro = '' OR e.centro_trabajo = p_centro)
    AND (p_empleado_id IS NULL OR e.id = p_empleado_id)
),
emp_doc AS (
  SELECT em.emp_id, em.emp_nombre, em.emp_email, em.emp_society_id, em.emp_centro,
         d.doc_id, d.nombre_archivo, d.folder_nombre, d.folder_id, d.doc_created_at,
         -- Compute the REAL assignment date:
         -- Earliest of (tag assignment date, department assignment date), or document
         -- creation date as fallback for the society-default path.
         COALESCE(
           (
             SELECT MIN(assign_dt) FROM (
               SELECT et.created_at AS assign_dt
               FROM prl_folder_tags pft
               JOIN etiquetado et ON et.tag_id = pft.tag_id
               WHERE pft.folder_id = d.folder_id AND et.entidad_id = em.emp_id
               UNION ALL
               SELECT edp.created_at AS assign_dt
               FROM prl_folder_departamentos pfd
               JOIN empleados_departamentos_prl edp ON edp.departamento_prl_id = pfd.departamento_prl_id
               WHERE pfd.folder_id = d.folder_id AND edp.empleado_id = em.emp_id
             ) all_assigns
           ),
           d.doc_created_at
         ) AS assignment_date
  FROM emps em
  JOIN docs d ON em.emp_society_id = d.folder_society_id::text
  WHERE EXISTS (
    SELECT 1 FROM prl_folder_tags pft
    JOIN etiquetado et ON et.tag_id = pft.tag_id
    WHERE pft.folder_id = d.folder_id AND et.entidad_id = em.emp_id
  )
  OR EXISTS (
    SELECT 1 FROM prl_folder_departamentos pfd
    JOIN empleados_departamentos_prl edp ON edp.departamento_prl_id = pfd.departamento_prl_id
    WHERE pfd.folder_id = d.folder_id AND edp.empleado_id = em.emp_id
  )
  OR (
    NOT EXISTS (SELECT 1 FROM prl_folder_tags pft2 WHERE pft2.folder_id = d.folder_id)
    AND NOT EXISTS (SELECT 1 FROM prl_folder_departamentos pfd2 WHERE pfd2.folder_id = d.folder_id)
  )
),
dls AS (
  SELECT DISTINCT empleado_id AS dl_emp, document_id AS dl_doc
  FROM prl_download_logs
  WHERE downloaded_at IS NOT NULL
),
agg AS (
  SELECT ed.emp_id AS r_empleado_id, ed.emp_nombre AS r_nombre, ed.emp_email AS r_email,
         ed.emp_society_id AS r_society_id, COALESCE(soc.nombre,'') AS r_society_nombre,
         ed.emp_centro AS r_centro,
         COUNT(DISTINCT ed.doc_id)::bigint AS r_asignados,
         COUNT(DISTINCT CASE WHEN dl.dl_doc IS NOT NULL THEN ed.doc_id END)::bigint AS r_descargados
  FROM emp_doc ed
  LEFT JOIN dls dl ON dl.dl_emp = ed.emp_id AND dl.dl_doc = ed.doc_id
  LEFT JOIN sociedades soc ON soc.id::text = ed.emp_society_id
  GROUP BY ed.emp_id, ed.emp_nombre, ed.emp_email, ed.emp_society_id, soc.nombre, ed.emp_centro
),
pend AS (
  SELECT ed.emp_id AS p_emp_id,
         jsonb_agg(
           jsonb_build_object(
             'doc_id',        ed.doc_id,
             'nombre_archivo', ed.nombre_archivo,
             'folder_nombre',  ed.folder_nombre,
             'created_at',     ed.assignment_date::text
           )
           ORDER BY ed.assignment_date
         ) AS p_docs
  FROM emp_doc ed
  LEFT JOIN dls dl ON dl.dl_emp = ed.emp_id AND dl.dl_doc = ed.doc_id
  WHERE dl.dl_doc IS NULL
  GROUP BY ed.emp_id
)
SELECT a.r_empleado_id, a.r_nombre, a.r_email, a.r_society_id, a.r_society_nombre, a.r_centro,
       a.r_asignados, a.r_descargados,
       (a.r_asignados - a.r_descargados)::bigint AS r_pendientes,
       COALESCE(p.p_docs, '[]'::jsonb) AS r_docs_pend
FROM agg a
LEFT JOIN pend p ON p.p_emp_id = a.r_empleado_id
ORDER BY (a.r_asignados - a.r_descargados) DESC, a.r_nombre
$$;
