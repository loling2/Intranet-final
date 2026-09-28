/*
# Add UPDATE policy on historial_contrato for admin/rrhh

1. Security
- Adds an UPDATE policy so admin and rrhh roles can edit the justificacion
  field of existing historial_contrato rows.
- No other fields are affected; the policy allows all updates for admin/rrhh
  since the table is an audit log of contract state changes.
*/

DROP POLICY IF EXISTS "admin_rrhh_update_historial_contrato" ON public.historial_contrato;
CREATE POLICY "admin_rrhh_update_historial_contrato"
ON public.historial_contrato FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['admin'::text, 'rrhh'::text])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['admin'::text, 'rrhh'::text])
  )
);