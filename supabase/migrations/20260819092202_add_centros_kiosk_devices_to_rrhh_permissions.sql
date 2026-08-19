INSERT INTO role_tab_permissions (role, tab_id, enabled)
VALUES
  ('rrhh', 'centros', true),
  ('rrhh', 'kiosk-devices', true),
  ('rrhh', 'devices', true)
ON CONFLICT (role, tab_id) DO NOTHING;