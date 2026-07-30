/*
# Historial de asignaciones de dispositivos

1. New Tables
- `dispositivos_historial`
  - `id` (uuid, PK)
  - `dispositivo_id` (uuid, FK a dispositivos, ON DELETE CASCADE)
  - `empleado_id` (text, id del empleado al que se asignó)
  - `empleado_nombre` (text, snapshot del nombre)
  - `accion` (text: 'asignado' | 'liberado' | 'transferido')
  - `estado_anterior` (text, snapshot del estado previo)
  - `estado_nuevo` (text, snapshot del estado nuevo)
  - `realizado_por` (text, nombre del usuario que hizo el cambio)
  - `created_at` (timestamptz, default now())

2. Security
- RLS enabled
- Solo admins, rrhh y prevencion pueden leer el historial
- Cualquier usuario autenticado puede insertar registros de historial
*/

CREATE TABLE IF NOT EXISTS dispositivos_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispositivo_id uuid NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  empleado_id text,
  empleado_nombre text NOT NULL DEFAULT '',
  accion text NOT NULL DEFAULT 'asignado',
  estado_anterior text,
  estado_nuevo text,
  realizado_por text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dispositivos_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_dispositivos_historial" ON dispositivos_historial;
CREATE POLICY "admins_read_dispositivos_historial"
  ON dispositivos_historial FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
  );

DROP POLICY IF EXISTS "rrhh_read_dispositivos_historial" ON dispositivos_historial;
CREATE POLICY "rrhh_read_dispositivos_historial"
  ON dispositivos_historial FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'rrhh')
  );

DROP POLICY IF EXISTS "prevencion_read_dispositivos_historial" ON dispositivos_historial;
CREATE POLICY "prevencion_read_dispositivos_historial"
  ON dispositivos_historial FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'prevencion')
  );

DROP POLICY IF EXISTS "authenticated_insert_dispositivos_historial" ON dispositivos_historial;
CREATE POLICY "authenticated_insert_dispositivos_historial"
  ON dispositivos_historial FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS dispositivos_historial_dispositivo_idx ON dispositivos_historial(dispositivo_id);
CREATE INDEX IF NOT EXISTS dispositivos_historial_created_at_idx ON dispositivos_historial(created_at DESC);
