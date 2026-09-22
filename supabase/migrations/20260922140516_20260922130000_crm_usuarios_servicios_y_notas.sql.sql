-- CRM: usuarios_servicios (clientes/usuarios asignados a centros) y crm_notas (notas diarias inmutables)

CREATE TABLE IF NOT EXISTS usuarios_servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  apellidos text DEFAULT '',
  email text DEFAULT '',
  telefono text DEFAULT '',
  observaciones text DEFAULT '',
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE usuarios_servicios ENABLE ROW LEVEL SECURITY;

-- Solo admin y rrhh pueden gestionar usuarios_servicios
CREATE POLICY "usuarios_servicios_select_staff"
  ON usuarios_servicios FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  );

CREATE POLICY "usuarios_servicios_insert_staff"
  ON usuarios_servicios FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  );

CREATE POLICY "usuarios_servicios_update_staff"
  ON usuarios_servicios FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  );

CREATE POLICY "usuarios_servicios_delete_staff"
  ON usuarios_servicios FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Tabla puente: asignación de usuarios_servicios a centros (muchos a muchos)
CREATE TABLE IF NOT EXISTS usuarios_servicios_centros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  centro_id uuid REFERENCES centros(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (usuario_servicio_id, centro_id)
);

ALTER TABLE usuarios_servicios_centros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "us_centros_select_staff"
  ON usuarios_servicios_centros FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  );

CREATE POLICY "us_centros_insert_staff"
  ON usuarios_servicios_centros FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  );

CREATE POLICY "us_centros_delete_staff"
  ON usuarios_servicios_centros FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  );

-- Tabla de notas del calendario (inmutables: solo insert y select, nunca update ni delete)
CREATE TABLE IF NOT EXISTS crm_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  autor_nombre text NOT NULL,
  contenido text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crm_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_notas_select_staff"
  ON crm_notas FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  );

CREATE POLICY "crm_notas_insert_staff"
  ON crm_notas FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  );

-- NO políticas de UPDATE ni DELETE: las notas son inmutables una vez creadas

-- Índices
CREATE INDEX IF NOT EXISTS idx_crm_notas_usuario_fecha ON crm_notas (usuario_servicio_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_us_centros_usuario ON usuarios_servicios_centros (usuario_servicio_id);

-- Sembrar permisos CRM para admin en role_tab_permissions
INSERT INTO role_tab_permissions (role, tab_id, enabled)
VALUES ('admin', 'crm', true)
ON CONFLICT (role, tab_id) DO NOTHING;