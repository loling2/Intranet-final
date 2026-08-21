-- Fix: Allow prevencion, supervisor, encargado, and administracion roles
-- to INSERT into employee_documents (folder 'publica' and 'privada').
-- Previously only admin and rrhh could insert, causing "error al subir documento"
-- when prevencion or supervisor users tried to upload employee documents.

DROP POLICY IF EXISTS "Admin RRHH insert docs" ON employee_documents;
DROP POLICY IF EXISTS "Staff insert employee docs" ON employee_documents;

CREATE POLICY "Staff insert employee docs"
  ON employee_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin','rrhh','prevencion','supervisor','encargado','administracion')
    )
  );

-- Also widen UPDATE and DELETE to the same set of staff roles
DROP POLICY IF EXISTS "Admin RRHH update docs" ON employee_documents;
DROP POLICY IF EXISTS "Staff update employee docs" ON employee_documents;

CREATE POLICY "Staff update employee docs"
  ON employee_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin','rrhh','prevencion','supervisor','encargado','administracion')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin','rrhh','prevencion','supervisor','encargado','administracion')
    )
  );

DROP POLICY IF EXISTS "Admin RRHH delete docs" ON employee_documents;
DROP POLICY IF EXISTS "Staff delete employee docs" ON employee_documents;

CREATE POLICY "Staff delete employee docs"
  ON employee_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin','rrhh','prevencion','supervisor','encargado','administracion')
    )
  );

-- Widen SELECT for staff to see all employee documents (not just admin/rrhh)
DROP POLICY IF EXISTS "Admin RRHH view all docs" ON employee_documents;
DROP POLICY IF EXISTS "Staff view all employee docs" ON employee_documents;

CREATE POLICY "Staff view all employee docs"
  ON employee_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin','rrhh','prevencion','supervisor','encargado','administracion')
    )
  );
