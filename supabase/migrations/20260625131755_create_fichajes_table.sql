CREATE TABLE IF NOT EXISTS fichajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id UUID REFERENCES empleados(id) ON DELETE SET NULL,
  nombre_empleado TEXT NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo_evento TEXT NOT NULL CHECK (tipo_evento IN ('entrada', 'salida', 'pausa_inicio', 'pausa_fin', 'permiso')),
  metodo VARCHAR(50) DEFAULT 'web',
  latitud DECIMAL(10, 8),
  longitud DECIMAL(11, 8),
  direccion_ip VARCHAR(100),
  user_agent TEXT,
  es_manual BOOLEAN DEFAULT FALSE,
  nota_correccion TEXT,
  CONSTRAINT nota_required_when_manual CHECK (NOT es_manual OR nota_correccion IS NOT NULL)
);

ALTER TABLE fichajes ENABLE ROW LEVEL SECURITY;

-- Admins and RRHH can see all fichajes
CREATE POLICY "admin_rrhh_select_fichajes" ON fichajes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'rrhh', 'supervisor')
    )
  );

-- Anyone can insert (PIN-validated from public flow)
CREATE POLICY "insert_fichajes_public" ON fichajes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admins/RRHH can update (for manual corrections)
CREATE POLICY "admin_rrhh_update_fichajes" ON fichajes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'rrhh')
    )
  );

-- Employees can see their own fichajes
CREATE POLICY "employee_select_own_fichajes" ON fichajes FOR SELECT
  TO authenticated
  USING (empleado_id = (
    SELECT id FROM empleados WHERE user_id = auth.uid() LIMIT 1
  ));

CREATE INDEX idx_fichajes_empleado_id ON fichajes(empleado_id);
CREATE INDEX idx_fichajes_fecha ON fichajes(fecha DESC);
CREATE INDEX idx_fichajes_timestamp ON fichajes(timestamp DESC);
