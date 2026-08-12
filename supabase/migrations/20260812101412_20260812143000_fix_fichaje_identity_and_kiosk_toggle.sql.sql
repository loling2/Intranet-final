/*
# Fix fichaje identity matching and kiosk toggle

1. Purpose
- Ensure kiosk check-ins determine the next event using the employee identifier instead of the displayed name.
- Keep one official employee name in new kiosk records.
- Prevent mobile and kiosk records for the same employee from being treated as separate people.

2. Modified function
- `public.kiosk_register_fichaje` now resolves the employee by PIN, locks that employee's daily rows, reads the latest event by `empleado_id`, and writes the official employee name from `empleados.nombre`.
- Existing center/device authorization behavior remains available.

3. Data safety
- No tables or columns are dropped or renamed.
- Existing records are not deleted.
- The function remains SECURITY DEFINER with a fixed public search path.
*/

CREATE OR REPLACE FUNCTION public.kiosk_register_fichaje(
  p_pin text,
  p_latitud double precision DEFAULT NULL,
  p_longitud double precision DEFAULT NULL,
  p_ubicacion text DEFAULT NULL,
  p_dispositivo text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_device_key text DEFAULT NULL
)
RETURNS TABLE(success boolean, tipo text, nombre_empleado text, error_msg text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_empleado_id uuid;
  v_nombre text;
  v_today date := current_date;
  v_last_event text;
  v_next_tipo text;
  v_device_id uuid;
  v_site_name text;
  v_centro_id uuid;
BEGIN
  IF p_device_key IS NOT NULL THEN
    SELECT id, site_name INTO v_device_id, v_site_name
    FROM kiosk_devices
    WHERE device_key = p_device_key AND is_active = true
    LIMIT 1;
    IF v_device_id IS NULL THEN
      RETURN QUERY SELECT false, NULL::text, NULL::text, 'DEVICE_NOT_AUTHORIZED';
      RETURN;
    END IF;
  END IF;

  SELECT vp.id INTO v_user_id
  FROM validate_vehicle_pin(p_pin) vp
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'PIN incorrecto';
    RETURN;
  END IF;

  SELECT e.id, e.nombre INTO v_empleado_id, v_nombre
  FROM empleados e
  WHERE e.user_id = v_user_id
  LIMIT 1;
  IF v_empleado_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'Empleado no encontrado';
    RETURN;
  END IF;

  IF v_site_name IS NOT NULL THEN
    SELECT c.id INTO v_centro_id
    FROM centros c
    WHERE lower(trim(c.nombre)) = lower(trim(v_site_name))
    LIMIT 1;
  END IF;

  PERFORM 1 FROM fichajes f
  WHERE f.empleado_id = v_empleado_id AND f.fecha = v_today
  FOR UPDATE;

  SELECT f.tipo_evento INTO v_last_event
  FROM fichajes f
  WHERE f.empleado_id = v_empleado_id AND f.fecha = v_today
  ORDER BY f.timestamp DESC
  LIMIT 1;

  v_next_tipo := CASE WHEN v_last_event = 'entrada' THEN 'salida' ELSE 'entrada' END;

  INSERT INTO fichajes (
    empleado_id, nombre_empleado, fecha, timestamp, tipo_evento,
    metodo, user_agent, dispositivo, es_manual,
    latitud, longitud, ubicacion, kiosk_device_id, centro_id
  ) VALUES (
    v_empleado_id, v_nombre, v_today, now(), v_next_tipo,
    'pin', p_user_agent, p_dispositivo, false,
    p_latitud, p_longitud, p_ubicacion, v_device_id, v_centro_id
  );

  IF v_device_id IS NOT NULL THEN
    UPDATE kiosk_devices SET last_seen_at = now() WHERE id = v_device_id;
  END IF;

  RETURN QUERY SELECT true, v_next_tipo, v_nombre, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.kiosk_register_fichaje(text, double precision, double precision, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_register_fichaje(text, double precision, double precision, text, text, text, text) TO anon, authenticated;