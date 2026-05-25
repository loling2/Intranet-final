/*
  # Crear tabla nominas

  1. Nueva tabla
    - `nominas`
      - `id` (uuid, PK)
      - `society_id` (text) — sociedad a la que pertenece
      - `dni` (text) — DNI o NIE del trabajador
      - `anio` (int) — año de la nómina
      - `mes` (int) — mes de la nómina (1-12)
      - `wasabi_key` (text) — ruta en Wasabi: rrhh/publico/{anio}/{mes}/{dni}-{mes}-{anio}.pdf
      - `nombre_archivo` (text) — nombre del archivo
      - `tamano_bytes` (int)
      - `subido_por` (uuid)
      - `subido_por_nombre` (text)
      - `pdf_origen` (text) — nombre del PDF original masivo del que se extrajo
      - `created_at` (timestamptz)

  2. Seguridad
    - RLS habilitado
    - Admin y rrhh pueden ver y gestionar todas las nóminas
    - Un empleado autenticado solo ve nóminas cuyo dni coincida con su dni en user_profiles
*/

CREATE TABLE IF NOT EXISTS nominas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id text NOT NULL DEFAULT '',
  dni text NOT NULL,
  anio integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  wasabi_key text NOT NULL,
  nombre_archivo text NOT NULL DEFAULT '',
  tamano_bytes integer NOT NULL DEFAULT 0,
  subido_por uuid,
  subido_por_nombre text NOT NULL DEFAULT '',
  pdf_origen text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE nominas ENABLE ROW LEVEL SECURITY;

-- Admin y rrhh pueden ver todas
CREATE POLICY "admin and rrhh can select nominas"
  ON nominas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
    )
  );

-- Admin y rrhh pueden insertar
CREATE POLICY "admin and rrhh can insert nominas"
  ON nominas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
    )
  );

-- Admin y rrhh pueden borrar
CREATE POLICY "admin and rrhh can delete nominas"
  ON nominas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
    )
  );

-- Empleados solo ven sus propias nóminas (por dni en user_profiles)
CREATE POLICY "employees can select own nominas by dni"
  ON nominas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role = 'employee'
        AND UPPER(REPLACE(REPLACE(dni, '-', ''), ' ', '')) = UPPER(REPLACE(REPLACE(nominas.dni, '-', ''), ' ', ''))
    )
  );

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS nominas_dni_idx ON nominas (dni);
CREATE INDEX IF NOT EXISTS nominas_anio_mes_idx ON nominas (anio, mes);
CREATE INDEX IF NOT EXISTS nominas_society_idx ON nominas (society_id);
