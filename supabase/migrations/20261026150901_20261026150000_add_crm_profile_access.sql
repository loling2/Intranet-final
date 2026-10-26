/*
# Add CRM as a selectable access profile

1. Purpose
- Treat CRM as an independent profile, alongside the existing Admin, RRHH and other profiles.
- Preserve the existing CRM access rule for users assigned through CRM patient permissions.

2. Modified database behavior
- Update `can_access_crm()` so a user can access CRM when either:
  - their primary role is `crm`,
  - their `roles` array contains `crm`, or
  - they are already covered by the existing admin, RRHH, or CRM assignment rules.

3. Data safety
- No tables, columns, rows, or existing policies are deleted or changed.
- The function remains available only to authenticated users.
*/

CREATE OR REPLACE FUNCTION public.can_access_crm()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          role IN ('admin', 'rrhh', 'crm')
          OR 'crm' = ANY(COALESCE(roles, ARRAY[]::text[]))
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.crm_paciente_asignaciones
      WHERE user_id = auth.uid()
    );
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_crm() FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_crm() TO authenticated;