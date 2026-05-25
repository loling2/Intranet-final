/*
  # Vehicles & Usage Log System

  1. New Tables
    - `vehicles`
      - `id` (uuid, PK)
      - `matricula` (text, unique)
      - `marca` (text)
      - `modelo` (text)
      - `kilometros_actuales` (integer)
      - `fecha_itv` (date)
      - `estado` ('libre' | 'en_uso')
      - `society_id` (text, FK to society)
      - `current_user_id` (uuid, nullable, who has it checked out)
      - `current_km_inicio` (integer, nullable)
      - `current_fecha_inicio` (timestamptz, nullable)
      - `created_at`, `updated_at`

    - `vehicle_logs`
      - `id` (uuid, PK)
      - `vehicle_id` (uuid, FK)
      - `user_id` (uuid, FK)
      - `user_nombre` (text, snapshot)
      - `fecha_inicio` (timestamptz)
      - `fecha_fin` (timestamptz, nullable)
      - `km_inicio` (integer)
      - `km_fin` (integer, nullable)
      - `duracion_minutos` (integer, nullable)
      - `tipo` ('normal' | 'incidencia')
      - `motivo` (text, nullable, for forced releases)
      - `liberado_por` (uuid, nullable, who forced release)
      - `created_at`

  2. Security
    - RLS enabled on both tables
    - Admin/RRHH can manage all vehicles
    - All authenticated users can read vehicles
    - Users can create/update their own logs
*/

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula text UNIQUE NOT NULL,
  marca text NOT NULL DEFAULT '',
  modelo text NOT NULL DEFAULT '',
  kilometros_actuales integer NOT NULL DEFAULT 0,
  fecha_itv date NOT NULL,
  estado text NOT NULL DEFAULT 'libre' CHECK (estado IN ('libre', 'en_uso')),
  society_id text NOT NULL DEFAULT '',
  current_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  current_user_nombre text,
  current_km_inicio integer,
  current_fecha_inicio timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and RRHH can insert vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'rrhh')
    )
  );

CREATE POLICY "Admins and RRHH can update vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'rrhh')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'rrhh')
    )
  );

-- Allow any authenticated user to update vehicle state for check-in/out
CREATE POLICY "Users can update vehicle state for checkin"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS vehicles_matricula_idx ON vehicles(matricula);
CREATE INDEX IF NOT EXISTS vehicles_estado_idx ON vehicles(estado);
CREATE INDEX IF NOT EXISTS vehicles_society_idx ON vehicles(society_id);

-- Vehicle usage logs
CREATE TABLE IF NOT EXISTS vehicle_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_nombre text NOT NULL DEFAULT '',
  fecha_inicio timestamptz NOT NULL DEFAULT now(),
  fecha_fin timestamptz,
  km_inicio integer NOT NULL DEFAULT 0,
  km_fin integer,
  duracion_minutos integer,
  tipo text NOT NULL DEFAULT 'normal' CHECK (tipo IN ('normal', 'incidencia')),
  motivo text,
  liberado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  liberado_por_nombre text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vehicle_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vehicle logs"
  ON vehicle_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert vehicle logs"
  ON vehicle_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins and RRHH can insert any vehicle log"
  ON vehicle_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'rrhh')
    )
  );

CREATE POLICY "Users can update own vehicle logs"
  ON vehicle_logs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins and RRHH can update any vehicle log"
  ON vehicle_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'rrhh')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'rrhh')
    )
  );

CREATE INDEX IF NOT EXISTS vehicle_logs_vehicle_idx ON vehicle_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS vehicle_logs_user_idx ON vehicle_logs(user_id);
