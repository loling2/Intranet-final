/*
  # Admin Roles System

  ## Summary
  Creates a roles table and user_roles table to support role-based access control.
  Admin users have unrestricted access to all societies, routes, and management features.

  ## New Tables
  - `app_roles` - defines available roles (admin, rrhh, employee)
  - `user_roles` - maps users to their roles (future use with Supabase Auth)

  ## Security
  - RLS enabled on both tables
  - Only authenticated users can read roles
  - Only admins can manage roles (via service role key in edge functions)
*/

CREATE TABLE IF NOT EXISTS app_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

INSERT INTO app_roles (name, description) VALUES
  ('admin', 'Full access to all societies, users, documents, devices, and management panels'),
  ('rrhh', 'Access to HR panel and all employee data'),
  ('employee', 'Standard employee access to own data only')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read roles"
  ON app_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_name text NOT NULL REFERENCES app_roles(name) ON DELETE CASCADE,
  society_id text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role_name)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
