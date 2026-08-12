/*
# Fix fichaje matching by employee identity

1. Purpose
Fichajes from the mobile and kiosk can contain different text versions of
an employee name. This caused the kiosk to treat a real mobile entry as if
there were no earlier entry, creating a second entry and an automatic closure.
The email report also grouped those rows as separate employees.

2. Modified function
- `kiosk_register_fichaje` now resolves the official employee name from
  `empleados.nombre`.
- It locks and reads the day's last event by `empleado_id`, not by the
  editable/display name.
- New kiosk fichajes keep the official employee name.

3. Data safety
- No existing fichajes are deleted or changed.
- No tables, columns, or RLS policies are changed.
- The function signature and device authorization behavior remain unchanged.
*/

CREATE OR REPLACE FUNCTION public.kiosk_register_fichaje(
  p_pin            text,
  p_latitud        double precision DEFAULT NULL,
  p_longitud       double precision DEFAULT NULL,
  p_ubicacion      text DEFAULT NULL,
  p_dispositivo    text DEFAULT NULL,
  p_user_agent     text DEFAULT NULL,
  p_device_key     text DEFAULT NULL
)
RETURNS TABLE (
  success         boolean,
  tipo            text,
  nombre_empleado text,
  error_msg       text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid;
  v_nombre        text;
  v_empleado_id   uuid;
  v_today         date := current_date;
  v_last_event    text;
  v_next_tipo     text;
  v_device_id     uuid;
BEGIN
  IF p_device_key IS NOT NULL THEN
    SELECT id INTO v_device_id
    FROM kiosk_devices
    WHERE device_key = p_device_key AND is_active = true
    LIMIT 1;

    IF v_device_id IS NULL THEN
      success := false; tipo := NULL; nombre_empleado := NULL;
      error_msg := 'DEVICE_NOT_AUTHORIZED'; RETURN NEXT; RETURN;
    END IF;
  END IF;

  SELECT vp.id INTO v_user_id
  FROM validate_vehicle_pin(p_pin) vp
  LIMIT 1;

  IF v_user_id IS NULL THEN
    success := false; tipo := NULL; nombre_empleado := NULL;
    error_msg := 'PIN incorrecto'; RETURN NEXT; RETURN;
  END IF;

  SELECT e.id, e.nombre
  INTO v_empleado_id, v_nombre
  FROM empleados e
  WHERE e.user_id = v_user_id
  LIMIT 1;

  IF v_empleado_id IS NULL THEN
    success := false; tipo := NULL; nombre_empleado := NULL;
    error_msg := 'Empleado no encontrado'; RETURN NEXT; RETURN;
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
    latitud, longitud, ubicacion, kiosk_device_id
  ) VALUES (
    v_empleado_id, v_nombre, v_today, now(), v_next_tipo,
    'pin', p_user_agent, p_dispositivo, false,
    p_latitud, p_longitud, p_ubicacion, v_device_id
  );

  IF v_device_id IS NOT NULL THEN
    UPDATE kiosk_devices SET last_seen_at = now() WHERE id = v_device_id;
  END IF;

  success := true;
  tipo := v_next_tipo;
  nombre_empleado := v_nombre;
  error_msg := NULL;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.kiosk_register_fichaje(text, double precision, double precision, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_register_fichaje(text, double precision, double precision, text, text, text, text) TO anon, authenticated;