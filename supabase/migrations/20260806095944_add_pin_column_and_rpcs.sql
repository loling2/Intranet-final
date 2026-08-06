/*
# Add PIN column to empleados and create fichaje RPC functions

1. Changes to existing tables
- `empleados`: add `pin` column (text, nullable) for kiosk authentication.
2. New RPC functions
- `verify_employee_pin(p_pin text)`: returns empleado id + nombre if PIN matches and employee is active.
- `register_fichaje(p_empleado_id uuid, p_tipo text, p_lat numeric, p_lng numeric)`: inserts a fichaje record using existing columns (tipo_evento, latitud, longitud, metodo='kiosk') and returns ok/message/tipo.
3. Security
- No RLS policy changes (empleados and fichajes already have policies).
*/

ALTER TABLE empleados ADD COLUMN IF NOT EXISTS pin text;

DROP INDEX IF EXISTS empleados_pin_key;

CREATE OR REPLACE FUNCTION verify_employee_pin(p_pin text)
RETURNS TABLE (id uuid, nombre text)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT id, nombre FROM empleados WHERE pin = p_pin AND activo = true;
$$;

CREATE OR REPLACE FUNCTION register_fichaje(
  p_empleado_id uuid,
  p_tipo text,
  p_lat numeric DEFAULT NULL,
  p_lng numeric DEFAULT NULL
)
RETURNS TABLE (ok boolean, message text, tipo text)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF p_tipo NOT IN ('entrada', 'salida') THEN
    RETURN QUERY SELECT false, 'Tipo no válido'::text, p_tipo;
    RETURN;
  END IF;

  INSERT INTO fichajes (empleado_id, nombre_empleado, fecha, timestamp, tipo_evento, metodo, latitud, longitud)
  SELECT p_empleado_id, nombre, CURRENT_DATE, now(), p_tipo, 'kiosk', p_lat, p_lng
  FROM empleados WHERE id = p_empleado_id;

  RETURN QUERY SELECT true,
    (p_tipo || ' registrada a las ' || to_char(now(), 'HH24:MI'))::text,
    p_tipo;
END;
$$;

-- Assign PINs to a few employees for testing (only if pin is null)
UPDATE empleados SET pin = '1234' WHERE id = (SELECT id FROM empleados WHERE pin IS NULL LIMIT 1);
UPDATE empleados SET pin = '5678' WHERE id = (SELECT id FROM empleados WHERE pin IS NULL LIMIT 1);
UPDATE empleados SET pin = '9012' WHERE id = (SELECT id FROM empleados WHERE pin IS NULL LIMIT 1);
