-- Reset supervisor role tab permissions to be a distinct profile from RRHH.
-- Supervisor tabs: overview, employees, vehicles, vacations, certificates, exams, supervisor-empleados
-- Everything else is disabled (no bajas, no facturas, no incidencias, no fichajes, no contratos, no users, no documents, etc.)

-- First, set ALL supervisor tabs to false
UPDATE role_tab_permissions SET enabled = false WHERE role = 'supervisor';

-- Then enable only the tabs that belong to supervisor
UPDATE role_tab_permissions SET enabled = true
WHERE role = 'supervisor' AND tab_id IN (
  'overview', 'employees', 'vehicles', 'vacations', 'certificates', 'exams', 'supervisor-empleados'
);

-- Insert any missing supervisor tab rows as disabled
INSERT INTO role_tab_permissions (role, tab_id, enabled)
SELECT 'supervisor', t.tab_id, false
FROM (VALUES
  ('overview'), ('employees'), ('vehicles'), ('vacations'), ('certificates'),
  ('exams'), ('supervisor-empleados'), ('bajas'), ('facturas'), ('incidencias'),
  ('fichajes'), ('contratos'), ('users'), ('documents'), ('personal-docs'),
  ('pdf-split'), ('audit'), ('prevencion'), ('devices'), ('kiosk-devices')
) AS t(tab_id)
WHERE NOT EXISTS (
  SELECT 1 FROM role_tab_permissions rtp WHERE rtp.role = 'supervisor' AND rtp.tab_id = t.tab_id
)
ON CONFLICT (role, tab_id) DO NOTHING;
