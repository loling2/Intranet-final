-- Unique constraint so upsert can replace duplicates
ALTER TABLE nominas ADD CONSTRAINT nominas_unique_per_period
  UNIQUE (society_id, dni, anio, mes);

-- Allow admin/rrhh to update (needed for upsert)
CREATE POLICY "admin and rrhh can update nominas"
  ON nominas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
    )
  );
