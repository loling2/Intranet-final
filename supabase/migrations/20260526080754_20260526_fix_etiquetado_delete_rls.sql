/*
  # Fix etiquetado DELETE policy for prevencion role

  The existing "Admin can delete etiquetado" policy only allows admins.
  The "Prevencion can delete etiquetado" policy should cover prevencion/admin/rrhh
  but may conflict. Drop both and replace with a single clear policy.
*/

DROP POLICY IF EXISTS "Admin can delete etiquetado" ON etiquetado;
DROP POLICY IF EXISTS "Prevencion can delete etiquetado" ON etiquetado;

CREATE POLICY "Admin rrhh prevencion can delete etiquetado"
  ON etiquetado FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'rrhh', 'prevencion')
        AND activo = true
    )
  );
