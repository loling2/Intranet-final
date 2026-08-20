-- Allow prevencion role to read all user_profiles, same as RRHH.
-- Without this, the User Management screen in the Prevencion panel
-- cannot see which employees already have an access account, so it
-- incorrectly reports all employees as "without access".

CREATE POLICY "Prevencion can read all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_prevencion());
