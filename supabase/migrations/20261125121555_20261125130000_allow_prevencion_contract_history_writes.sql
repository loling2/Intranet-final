/*
# Allow Prevención to update contract status history

1. Purpose
- Fixes the contract status change flow for users with the Prevención profile.
- The employee status update is followed by an insert into `historial_contrato`; that insert was previously limited to `admin` and `rrhh`.

2. Modified tables
- `historial_contrato`
- No columns, types, rows, or relationships are changed.

3. Security changes
- Keeps Row Level Security enabled.
- Extends the existing SELECT, INSERT, and UPDATE policies to include the existing `is_prevencion()` server-side role check.
- Does not grant access to anonymous users or employees.
- Does not change delete access.

4. Important notes
- The existing role helper checks the authenticated user's database profile and configured roles.
- Access remains limited to authenticated users whose profile is `admin`, `rrhh`, or `prevencion` according to the corresponding policy.
- Table grants remain unchanged because the authenticated role already has the required privileges.
*/

DROP POLICY IF EXISTS "admin_rrhh_select_historial_contrato" ON historial_contrato;
CREATE POLICY "admin_rrhh_select_historial_contrato"
  ON historial_contrato FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE id = auth.uid()
        AND (role IN ('admin', 'rrhh') OR 'admin' = ANY(roles) OR 'rrhh' = ANY(roles))
    )
    OR is_prevencion()
  );

DROP POLICY IF EXISTS "admin_rrhh_insert_historial_contrato" ON historial_contrato;
CREATE POLICY "admin_rrhh_insert_historial_contrato"
  ON historial_contrato FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE id = auth.uid()
        AND (role IN ('admin', 'rrhh') OR 'admin' = ANY(roles) OR 'rrhh' = ANY(roles))
    )
    OR is_prevencion()
  );

DROP POLICY IF EXISTS "admin_rrhh_update_historial_contrato" ON historial_contrato;
CREATE POLICY "admin_rrhh_update_historial_contrato"
  ON historial_contrato FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE id = auth.uid()
        AND (role IN ('admin', 'rrhh') OR 'admin' = ANY(roles) OR 'rrhh' = ANY(roles))
    )
    OR is_prevencion()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE id = auth.uid()
        AND (role IN ('admin', 'rrhh') OR 'admin' = ANY(roles) OR 'rrhh' = ANY(roles))
    )
    OR is_prevencion()
  );