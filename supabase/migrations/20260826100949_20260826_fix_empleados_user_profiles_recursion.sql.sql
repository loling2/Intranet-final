/*
# Fix infinite recursion between empleados and user_profiles

1. Purpose
- Stop the "infinite recursion detected in policy for relation empleados/user_profiles" error.
- Root cause: the policy "Prevencion can view all empleados" on empleados contains an inline
  subquery against user_profiles. user_profiles policies call is_admin_or_rrhh() / is_gerontalia_scoped()
  which read user_profiles. When Postgres evaluates the empleados SELECT policy it enters user_profiles RLS,
  which re-enters empleados RLS via the gerontalia policy (which joins empleados), creating a cycle.
- Fix: replace the inline user_profiles subquery with the is_prevencion() SECURITY DEFINER helper
  (which bypasses RLS internally), and ensure is_prevencion() also has row_security=off.

2. Security changes
- ALTER FUNCTION is_prevencion() to add SET row_security TO 'off' (it already had search_path=public).
- DROP and recreate the "Prevencion can view all empleados" SELECT policy to use is_prevencion()
  instead of an inline user_profiles subquery.
- No other policies, tables, columns, or data are touched.

3. Important notes
- Global roles (admin, rrhh, supervisor, prevencion, etc.) keep their existing access unchanged.
- Gerontalia-scoped roles keep their society-filtered access unchanged.
- Only the mechanism of the prevencion SELECT check on empleados changes (inline subquery → helper function).
*/

-- 1. Fix is_prevencion() to bypass RLS internally (prevents recursion)
CREATE OR REPLACE FUNCTION public.is_prevencion()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'prevencion'
  );
$$;

-- 2. Replace the recursive empleados SELECT policy
DROP POLICY IF EXISTS "Prevencion can view all empleados" ON empleados;
DROP POLICY IF EXISTS "Prevencion can view all employees" ON empleados;

CREATE POLICY "Prevencion can view all empleados"
ON empleados FOR SELECT
TO authenticated
USING (is_prevencion() OR is_admin_or_rrhh());
