/*
  # Fix RLS Recursion, Auth Sync, and Password Update

  ## Problems Fixed

  1. RLS recursion: policies on user_profiles queried user_profiles itself causing infinite loops
     - Replaced inline subqueries with SECURITY DEFINER helper functions that bypass RLS
  
  2. Duplicate user_profile for rrhh@empresa.com (orphan row without auth.users entry)
     - Removes the orphan row safely
  
  3. update_user_password used bare crypt() - updated to use extensions.crypt() for reliability
  
  4. Auto-sync trigger: ensures every new auth.users row gets a user_profile automatically
     - Prevents "profile not found" errors on login
  
  ## Security
  - All helper functions are SECURITY DEFINER with fixed search_path
  - RLS remains enabled and restrictive on all tables
  - Trigger runs as SECURITY DEFINER to insert profiles regardless of caller RLS context
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SECURITY DEFINER helpers that bypass RLS (safe, read-only)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_admin_or_rrhh()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop all existing user_profiles policies and recreate without recursion
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "RRHH can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "RRHH can update non-admin profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON user_profiles;

-- SELECT: own profile OR admin OR rrhh
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "RRHH can read all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_admin_or_rrhh());

-- INSERT: only admin or rrhh
CREATE POLICY "Admins can insert profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_rrhh());

-- UPDATE: own profile (self-service)
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- UPDATE: admin can update anyone
CREATE POLICY "Admins can update all profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- UPDATE: rrhh can update non-admin profiles
CREATE POLICY "RRHH can update non-admin profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (is_admin_or_rrhh() AND role <> 'admin')
  WITH CHECK (is_admin_or_rrhh() AND role <> 'admin');

-- DELETE: only admin
CREATE POLICY "Admins can delete profiles"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Fix update_user_password to use extensions.crypt
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_user_password(p_user_id uuid, p_new_password text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Auto-sync trigger: create user_profile on every new auth.users signup
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_profiles (id, email, nombre, role, activo, societies)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    'employee',
    true,
    '{}'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Remove orphan user_profile for rrhh (no matching auth.users entry)
-- ─────────────────────────────────────────────────────────────────────────────

DELETE FROM user_profiles
WHERE id = '505a6e75-de93-4d0b-9d6d-721631cf486f'
  AND NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = '505a6e75-de93-4d0b-9d6d-721631cf486f'
  );
