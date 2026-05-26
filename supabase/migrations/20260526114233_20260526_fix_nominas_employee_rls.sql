/*
  # Fix nominas RLS policy for employees

  The existing "employees can select own nominas by dni" policy had a bug:
  it was comparing nominas.dni to itself instead of to the user's own DNI
  in user_profiles.

  This migration drops and recreates the policy so employees can only read
  nominas where nominas.dni matches their own DNI stored in user_profiles.
*/

DROP POLICY IF EXISTS "employees can select own nominas by dni" ON nominas;

CREATE POLICY "employees can select own nominas by dni"
  ON nominas
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'employee'
        AND upper(replace(replace(up.dni, '-', ''), ' ', '')) =
            upper(replace(replace(nominas.dni, '-', ''), ' ', ''))
    )
  );
