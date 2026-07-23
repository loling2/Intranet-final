
-- Aggregate PRL trazabilidad statistics per employee
CREATE OR REPLACE FUNCTION get_prl_trazabilidad_stats(
  p_society_id text DEFAULT NULL,
  p_centro      text DEFAULT NULL
)
RETURNS TABLE (
  empleado_id    uuid,
  nombre         text,
  email          text,
  society_id     text,
  society_nombre text,
  centro_trabajo text,
  total_asignados   bigint,
  total_descargados bigint,
  total_pendientes  bigint,
  docs_pendientes   jsonb
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH
  docs AS (
    SELECT
      pd.id               AS doc_id,
      pd.nombre_archivo,
      pd.created_at       AS doc_created_at,
      pf.society_id       AS folder_society_id,
      COALESCE(pf.access_tag, '') AS access_tag,
      pf.nombre           AS folder_nombre
    FROM prl_documents pd
    JOIN prl_folders   pf ON pf.id = pd.folder_id
    WHERE (p_society_id IS NULL OR pf.society_id = p_society_id)
  ),
  emps AS (
    SELECT
      e.id                  AS emp_id,
      e.nombre              AS emp_nombre,
      COALESCE(e.email, '')           AS emp_email,
      COALESCE(e.id_sociedad, '')     AS emp_society_id,
      COALESCE(e.centro_trabajo, '')  AS emp_centro,
      COALESCE(
        array_agg(DISTINCT pet.tag_nombre) FILTER (WHERE pet.tag_nombre IS NOT NULL),
        ARRAY[]::text[]
      ) AS emp_tags
    FROM empleados e
    LEFT JOIN prl_employee_tags pet ON pet.empleado_id = e.id
    WHERE e.activo = true
      AND (p_society_id IS NULL OR e.id_sociedad = p_society_id)
      AND (p_centro IS NULL OR p_centro = '' OR e.centro_trabajo = p_centro)
    GROUP BY e.id, e.nombre, e.email, e.id_sociedad, e.centro_trabajo
  ),
  emp_doc AS (
    SELECT
      em.emp_id,
      em.emp_nombre,
      em.emp_email,
      em.emp_society_id,
      em.emp_centro,
      d.doc_id,
      d.nombre_archivo,
      d.doc_created_at,
      d.folder_nombre
    FROM emps em
    JOIN docs d
      ON  em.emp_society_id = d.folder_society_id
      AND (d.access_tag = '' OR d.access_tag = ANY(em.emp_tags))
  ),
  dls AS (
    SELECT DISTINCT empleado_id AS dl_emp, document_id AS dl_doc
    FROM prl_download_logs
  )
  SELECT
    ed.emp_id                                                         AS empleado_id,
    ed.emp_nombre                                                     AS nombre,
    ed.emp_email                                                      AS email,
    ed.emp_society_id                                                 AS society_id,
    COALESCE(soc.nombre, ed.emp_society_id)                           AS society_nombre,
    ed.emp_centro                                                     AS centro_trabajo,
    COUNT(DISTINCT ed.doc_id)::bigint                                 AS total_asignados,
    COUNT(DISTINCT CASE WHEN dl.dl_doc IS NOT NULL THEN ed.doc_id END)::bigint AS total_descargados,
    (COUNT(DISTINCT ed.doc_id)
     - COUNT(DISTINCT CASE WHEN dl.dl_doc IS NOT NULL THEN ed.doc_id END))::bigint AS total_pendientes,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'doc_id',         ed.doc_id,
          'nombre_archivo', ed.nombre_archivo,
          'folder_nombre',  ed.folder_nombre,
          'created_at',     ed.doc_created_at
        ) ORDER BY ed.doc_created_at
      ) FILTER (WHERE dl.dl_doc IS NULL),
      '[]'::jsonb
    ) AS docs_pendientes
  FROM emp_doc ed
  LEFT JOIN dls     dl  ON dl.dl_emp  = ed.emp_id AND dl.dl_doc = ed.doc_id
  LEFT JOIN sociedades soc ON soc.id  = ed.emp_society_id
  GROUP BY ed.emp_id, ed.emp_nombre, ed.emp_email, ed.emp_society_id, soc.nombre, ed.emp_centro
  ORDER BY total_pendientes DESC, nombre;
END;
$$;
