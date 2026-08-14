/*
# Añadir carpeta Prevención a los documentos de trabajadores

1. Cambios de datos
- Se amplía `employee_documents.folder` para aceptar `prevencion` además de `publica` y `privada`.
- Los documentos de Prevención mantienen el trabajador propietario mediante `employee_id`.
- Se añade un índice para consultar rápidamente la carpeta de Prevención de cada trabajador.

2. Seguridad
- El rol `prevencion` puede consultar, subir, modificar y eliminar documentos de la carpeta `prevencion`.
- Admin y RRHH conservan su acceso completo a los documentos existentes.
- Los empleados no reciben acceso a esta carpeta privada desde estas políticas.

3. Notas
- La carpeta se representa mediante el prefijo privado `empleados/<trabajador>/prevencion/` en el almacenamiento existente.
- No se eliminan ni modifican documentos existentes.
*/

ALTER TABLE employee_documents
  DROP CONSTRAINT IF EXISTS employee_documents_folder_check;

ALTER TABLE employee_documents
  ADD CONSTRAINT employee_documents_folder_check
  CHECK (folder IN ('publica', 'privada', 'prevencion'));

DROP POLICY IF EXISTS "Prevencion view employee prevention docs" ON employee_documents;
CREATE POLICY "Prevencion view employee prevention docs"
  ON employee_documents FOR SELECT
  TO authenticated
  USING (
    folder = 'prevencion'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'prevencion'
    )
  );

DROP POLICY IF EXISTS "Prevencion insert employee prevention docs" ON employee_documents;
CREATE POLICY "Prevencion insert employee prevention docs"
  ON employee_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    folder = 'prevencion'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'prevencion'
    )
  );

DROP POLICY IF EXISTS "Prevencion update employee prevention docs" ON employee_documents;
CREATE POLICY "Prevencion update employee prevention docs"
  ON employee_documents FOR UPDATE
  TO authenticated
  USING (
    folder = 'prevencion'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'prevencion'
    )
  )
  WITH CHECK (
    folder = 'prevencion'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'prevencion'
    )
  );

DROP POLICY IF EXISTS "Prevencion delete employee prevention docs" ON employee_documents;
CREATE POLICY "Prevencion delete employee prevention docs"
  ON employee_documents FOR DELETE
  TO authenticated
  USING (
    folder = 'prevencion'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'prevencion'
    )
  );

CREATE INDEX IF NOT EXISTS idx_employee_docs_prevencion
  ON employee_documents (employee_id, folder, created_at DESC);
