/*
  # Crear tabla custom_roles

  1. Nueva tabla
    - `custom_roles`
      - `id` (uuid, PK)
      - `nombre` (text, unique) — nombre del rol
      - `descripcion` (text) — descripción opcional
      - `color` (text) — color HEX para identificación visual
      - `created_at` (timestamptz)

  2. Seguridad
    - RLS habilitado
    - Solo admin puede insertar, actualizar y borrar
    - Admin y rrhh pueden leer
*/

CREATE TABLE IF NOT EXISTS custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text UNIQUE NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#64748B',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin and rrhh can select custom_roles"
  ON custom_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
    )
  );

CREATE POLICY "admin can insert custom_roles"
  ON custom_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "admin can update custom_roles"
  ON custom_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "admin can delete custom_roles"
  ON custom_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
