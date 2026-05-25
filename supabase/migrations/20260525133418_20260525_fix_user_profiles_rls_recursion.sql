/*
  # Fix user_profiles RLS infinite recursion

  The SELECT policies on user_profiles were doing a subquery back into user_profiles
  to check the role, causing infinite recursion. Replace them with the existing
  is_admin() and is_admin_or_rrhh() helper functions which use a security definer
  context that avoids the recursion.
*/

DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "RRHH can read all profiles" ON user_profiles;

CREATE POLICY "Admins can read all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "RRHH can read all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_admin_or_rrhh());
