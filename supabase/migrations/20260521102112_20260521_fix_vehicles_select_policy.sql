/*
  # Fix vehicles SELECT policy to allow anon access

  The SELECT policy was restricted to authenticated role, but the app
  connects as anon. This replaces it to allow both anon and authenticated.
*/

DROP POLICY IF EXISTS "Authenticated users can read vehicles" ON vehicles;

CREATE POLICY "Allow all select on vehicles"
  ON vehicles FOR SELECT
  TO anon, authenticated
  USING (true);
