/*
  # Estado de Contrato y Trazabilidad

  ## Cambios en tabla `empleados`
    - Nueva columna `estado_contrato` (text): estado actual del contrato del empleado.
      Valores posibles: 'pendiente', 'avisado', 'firmado'. Por defecto 'pendiente'.

  ## Nueva tabla `historial_contrato`
    - Registra cada cambio de estado del contrato de un empleado.
    - Columnas:
      - `id` (uuid, PK)
      - `empleado_id` (uuid, FK -> empleados.id)
      - `estado_anterior` (text): estado antes del cambio
      - `estado_nuevo` (text): estado después del cambio
      - `justificacion` (text): texto obligatorio al cambiar de estado
      - `cambiado_por` (uuid, nullable): id del usuario que hizo el cambio
      - `cambiado_por_nombre` (text): nombre del usuario que hizo el cambio
      - `created_at` (timestamptz)

  ## Seguridad
    - RLS habilitado en `historial_contrato`
    - Admin y RRHH pueden insertar y leer
    - Empleados no pueden leer ni escribir
*/

-- 1. Añadir columna estado_contrato a empleados si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'empleados' AND column_name = 'estado_contrato'
  ) THEN
    ALTER TABLE empleados ADD COLUMN estado_contrato text NOT NULL DEFAULT 'pendiente';
  END IF;
END $$;

-- 2. Crear tabla historial_contrato
CREATE TABLE IF NOT EXISTS historial_contrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  estado_anterior text NOT NULL,
  estado_nuevo text NOT NULL,
  justificacion text NOT NULL DEFAULT '',
  cambiado_por uuid,
  cambiado_por_nombre text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Índice para consultas frecuentes por empleado
CREATE INDEX IF NOT EXISTS idx_historial_contrato_empleado ON historial_contrato(empleado_id);

-- 4. RLS
ALTER TABLE historial_contrato ENABLE ROW LEVEL SECURITY;

-- Admin y RRHH pueden leer todo el historial
CREATE POLICY "admin_rrhh_select_historial_contrato"
  ON historial_contrato FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
    )
  );

-- Admin y RRHH pueden insertar
CREATE POLICY "admin_rrhh_insert_historial_contrato"
  ON historial_contrato FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
    )
  );
