
-- Table to store which tabs are enabled for each role
CREATE TABLE IF NOT EXISTS role_tab_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  tab_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, tab_id)
);

ALTER TABLE role_tab_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage permissions
CREATE POLICY "admin_select_role_tab_permissions" ON role_tab_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_insert_role_tab_permissions" ON role_tab_permissions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "admin_update_role_tab_permissions" ON role_tab_permissions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "admin_delete_role_tab_permissions" ON role_tab_permissions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Seed default permissions: all tabs enabled for all non-admin roles
-- Roles: rrhh, prevencion, supervisor, administracion, employee
-- Tabs for rrhh panel: overview, employees, personal-docs, vacations, certificates, exams, users, vehicles, documents, pdf-split, audit, contratos, prevencion, facturas, incidencias, fichajes
-- Tabs for prevencion/administracion panels have their own sets

INSERT INTO role_tab_permissions (role, tab_id, enabled) VALUES
  -- RRHH tabs
  ('rrhh', 'overview', true),
  ('rrhh', 'employees', true),
  ('rrhh', 'personal-docs', true),
  ('rrhh', 'vacations', true),
  ('rrhh', 'certificates', true),
  ('rrhh', 'exams', true),
  ('rrhh', 'users', true),
  ('rrhh', 'vehicles', true),
  ('rrhh', 'documents', true),
  ('rrhh', 'pdf-split', true),
  ('rrhh', 'audit', true),
  ('rrhh', 'contratos', true),
  ('rrhh', 'prevencion', true),
  ('rrhh', 'facturas', true),
  ('rrhh', 'incidencias', true),
  ('rrhh', 'fichajes', true),
  -- Supervisor tabs
  ('supervisor', 'overview', true),
  ('supervisor', 'employees', true),
  ('supervisor', 'vehicles', true),
  ('supervisor', 'vacations', true),
  ('supervisor', 'certificates', true),
  ('supervisor', 'exams', true),
  ('supervisor', 'facturas', true),
  ('supervisor', 'personal-docs', false),
  ('supervisor', 'users', false),
  ('supervisor', 'documents', false),
  ('supervisor', 'pdf-split', false),
  ('supervisor', 'audit', false),
  ('supervisor', 'contratos', false),
  ('supervisor', 'prevencion', false),
  ('supervisor', 'incidencias', true),
  ('supervisor', 'fichajes', true),
  -- Prevencion tabs
  ('prevencion', 'overview', true),
  ('prevencion', 'employees', true),
  ('prevencion', 'documents', true),
  ('prevencion', 'prl-docs', true),
  ('prevencion', 'personal-docs', false),
  ('prevencion', 'incidencias', true),
  ('prevencion', 'fichajes', false),
  -- Administracion tabs
  ('administracion', 'overview', true),
  ('administracion', 'employees', true),
  ('administracion', 'documents', true),
  ('administracion', 'facturas', true),
  ('administracion', 'contratos', true),
  ('administracion', 'vehicles', false),
  ('administracion', 'personal-docs', true),
  ('administracion', 'incidencias', true),
  ('administracion', 'fichajes', false),
  -- Employee tabs
  ('employee', 'personal-docs', true),
  ('employee', 'vacations', true),
  ('employee', 'certificates', true),
  ('employee', 'exams', true),
  ('employee', 'incidencias', true),
  ('employee', 'prl-docs', true),
  ('employee', 'fichajes', true)
ON CONFLICT (role, tab_id) DO NOTHING;
