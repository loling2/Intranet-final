/*
  # Add is_prevencion() helper function
  Mirrors the pattern of is_admin() and is_admin_or_rrhh() to check
  if the current authenticated user has the prevencion role.
*/
CREATE OR REPLACE FUNCTION is_prevencion()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'prevencion'
  );
$$;
