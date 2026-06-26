-- Allow prevencion (and other non-employee roles) to see their own nominas by DNI match
CREATE POLICY "own role can select own nominas by dni"
  ON nominas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role NOT IN ('admin', 'rrhh')
        AND upper(replace(replace(up.dni, '-', ''), ' ', '')) =
            upper(replace(replace(nominas.dni, '-', ''), ' ', ''))
    )
  );
