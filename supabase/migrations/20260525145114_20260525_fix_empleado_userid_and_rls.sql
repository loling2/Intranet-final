/*
  # Enlazar empleado con su auth user_id y corregir RLS de PRL

  1. Enlazar el registro de empleados con el auth.uid del usuario empleado@empresa.com
  2. Corregir las políticas de prl_folders y prl_documents para que los employees
     puedan ver documentos según sus tags asignados a través del empleado.id,
     no directamente por auth.uid
*/

-- 1. Enlazar user_id en empleados
UPDATE empleados
SET user_id = (SELECT id FROM auth.users WHERE email = 'empleado@empresa.com')
WHERE email = 'empleado@empresa.com';

-- 2. Corregir política SELECT de prl_folders para employees:
--    busca el empleado por user_id y comprueba sus etiquetas
DROP POLICY IF EXISTS "prl_folders select with tag access control" ON prl_folders;

CREATE POLICY "prl_folders select with tag access control"
  ON prl_folders FOR SELECT
  TO authenticated
  USING (
    -- Admin/RRHH/Prevencion ven todo
    (EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = ANY(ARRAY['admin','rrhh','prevencion'])
    ))
    OR
    -- Employee ve carpetas donde su tag (vía empleados) coincide con access_tag_id
    (prl_folders.access_tag_id IS NULL)
    OR
    (EXISTS (
      SELECT 1
      FROM empleados emp
      JOIN etiquetado et ON et.entidad_id = emp.id
      WHERE emp.user_id = auth.uid()
        AND et.tag_id = prl_folders.access_tag_id
    ))
  );

-- 3. Corregir política SELECT de prl_documents para employees
DROP POLICY IF EXISTS "prl_documents select with tag access control" ON prl_documents;

CREATE POLICY "prl_documents select with tag access control"
  ON prl_documents FOR SELECT
  TO authenticated
  USING (
    -- Admin/RRHH/Prevencion ven todo
    (EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = ANY(ARRAY['admin','rrhh','prevencion'])
    ))
    OR
    -- Employee ve documentos de carpetas sin restricción o con su tag
    (EXISTS (
      SELECT 1 FROM prl_folders pf
      WHERE pf.id = prl_documents.folder_id
        AND (
          pf.access_tag_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM empleados emp
            JOIN etiquetado et ON et.entidad_id = emp.id
            WHERE emp.user_id = auth.uid()
              AND et.tag_id = pf.access_tag_id
          )
        )
    ))
  );
