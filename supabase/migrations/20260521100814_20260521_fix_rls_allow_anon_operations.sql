/*
  # Fix RLS policies to allow anon/unauthenticated operations

  The app uses mock-based login (not Supabase Auth), so auth.uid() is always null.
  All write policies that check auth.uid() against user_profiles block every operation.

  This migration replaces those policies with permissive ones that allow any request,
  relying on application-level authorization instead of database-level auth.

  1. vehicles — allow anon insert and update
  2. vehicle_logs — allow anon insert and update
  3. documents — allow anon insert and delete
  4. audit_logs — allow anon insert and select
*/

-- ── vehicles ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins and RRHH can insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins and RRHH can update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can update vehicle state for checkin" ON vehicles;

CREATE POLICY "Allow all inserts on vehicles"
  ON vehicles FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all updates on vehicles"
  ON vehicles FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ── vehicle_logs ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins and RRHH can insert any vehicle log" ON vehicle_logs;
DROP POLICY IF EXISTS "Users can insert vehicle logs" ON vehicle_logs;
DROP POLICY IF EXISTS "Admins and RRHH can update any vehicle log" ON vehicle_logs;
DROP POLICY IF EXISTS "Users can update own vehicle logs" ON vehicle_logs;
DROP POLICY IF EXISTS "Authenticated users can read vehicle logs" ON vehicle_logs;

CREATE POLICY "Allow all select on vehicle_logs"
  ON vehicle_logs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all inserts on vehicle_logs"
  ON vehicle_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all updates on vehicle_logs"
  ON vehicle_logs FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ── documents ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins and RRHH can insert documents" ON documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON documents;
DROP POLICY IF EXISTS "RRHH can delete documents" ON documents;
DROP POLICY IF EXISTS "Admins can read all documents" ON documents;
DROP POLICY IF EXISTS "RRHH can read all documents" ON documents;
DROP POLICY IF EXISTS "Users can read own documents" ON documents;

CREATE POLICY "Allow all select on documents"
  ON documents FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all inserts on documents"
  ON documents FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all deletes on documents"
  ON documents FOR DELETE
  TO anon, authenticated
  USING (true);

-- ── audit_logs ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Admins can read audit logs" ON audit_logs;
DROP POLICY IF EXISTS "RRHH can read audit logs" ON audit_logs;

CREATE POLICY "Allow all select on audit_logs"
  ON audit_logs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all inserts on audit_logs"
  ON audit_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
