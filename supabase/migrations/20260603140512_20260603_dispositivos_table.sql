/*
  # Tabla de Dispositivos IT

  ## Nueva tabla: dispositivos
  Almacena el inventario de dispositivos tecnológicos asignados a empleados.

  ### Columnas
  - id: UUID primary key
  - tipo: Tipo de dispositivo (Portátil, Sobremesa, Monitor, Móvil, Tablet, etc.)
  - marca_modelo: Marca y modelo del dispositivo
  - caracteristicas: Especificaciones técnicas compactas (RAM, procesador, almacenamiento)
  - centro_trabajo: Centro o sede asignada
  - numero_serie: Número de serie del dispositivo (único por sociedad)
  - activo: Si el dispositivo está activo/en uso
  - society_id: Sociedad a la que pertenece el dispositivo
  - empleado_id: Referencia al empleado asignado (nullable)
  - usuario_asignado_nombre: Nombre del usuario asignado (desnormalizado para consultas rápidas)
  - fecha_asignacion: Fecha en que se asignó al empleado
  - notas: Observaciones adicionales
  - created_at / updated_at: Timestamps

  ## Seguridad
  - RLS habilitado
  - Admin puede hacer todo (SELECT, INSERT, UPDATE, DELETE)
  - Empleados solo pueden ver sus propios dispositivos asignados
*/

CREATE TABLE IF NOT EXISTS dispositivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT '',
  marca_modelo text NOT NULL DEFAULT '',
  caracteristicas text NOT NULL DEFAULT '',
  centro_trabajo text NOT NULL DEFAULT '',
  numero_serie text NOT NULL DEFAULT '',
  activo boolean NOT NULL DEFAULT true,
  society_id text NOT NULL,
  empleado_id uuid REFERENCES empleados(id) ON DELETE SET NULL,
  usuario_asignado_nombre text NOT NULL DEFAULT '',
  fecha_asignacion date,
  notas text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by society and employee
CREATE INDEX IF NOT EXISTS dispositivos_society_id_idx ON dispositivos(society_id);
CREATE INDEX IF NOT EXISTS dispositivos_empleado_id_idx ON dispositivos(empleado_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_dispositivos_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dispositivos_updated_at ON dispositivos;
CREATE TRIGGER dispositivos_updated_at
  BEFORE UPDATE ON dispositivos
  FOR EACH ROW EXECUTE FUNCTION update_dispositivos_updated_at();

ALTER TABLE dispositivos ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admin can select dispositivos"
  ON dispositivos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

CREATE POLICY "Admin can insert dispositivos"
  ON dispositivos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

CREATE POLICY "Admin can update dispositivos"
  ON dispositivos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

CREATE POLICY "Admin can delete dispositivos"
  ON dispositivos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

-- Employees: can only see their own assigned devices
CREATE POLICY "Employees can select own dispositivos"
  ON dispositivos FOR SELECT
  TO authenticated
  USING (
    empleado_id IN (
      SELECT id FROM empleados WHERE user_id = auth.uid()
    )
  );
