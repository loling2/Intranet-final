-- Update the device_key version of kiosk_register_fichaje to:
-- 1. Use kiosk_devices.centro_id directly (not match by site_name)
-- 2. Auto-update employee's centro on ENTRADA
-- 3. Record centro change in employee_centro_history

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
SET search_path TO 'public'
AS $function$
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
  v_centro_nombre text;
BEGIN
  -- Look up device by device_key
  IF p_device_key IS NOT NULL THEN
    SELECT kd.id, kd.site_name, kd.centro_id
    INTO v_device_id, v_site_name, v_centro_id
    FROM kiosk_devices kd
    WHERE kd.device_key = p_device_key AND kd.is_active = true
    LIMIT 1;

    IF v_device_id IS NULL THEN
      RETURN QUERY SELECT false, NULL::text, NULL::text, 'DEVICE_NOT_AUTHORIZED';
      RETURN;
    END IF;
  END IF;

  -- Validate PIN
  SELECT vp.id INTO v_user_id
  FROM validate_vehicle_pin(p_pin) vp
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'PIN incorrecto';
    RETURN;
  END IF;

  -- Find employee
  SELECT e.id, e.nombre INTO v_empleado_id, v_nombre
  FROM empleados e
  WHERE e.user_id = v_user_id
  LIMIT 1;
  IF v_empleado_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'Empleado no encontrado';
    RETURN;
  END IF;

  -- Get centro name if we have a centro_id from the device
  IF v_centro_id IS NOT NULL THEN
    SELECT c.nombre INTO v_centro_nombre FROM centros c WHERE c.id = v_centro_id LIMIT 1;
  END IF;

  -- Lock employee's fichaje rows for today
  PERFORM 1 FROM fichajes f
  WHERE f.empleado_id = v_empleado_id AND f.fecha = v_today
  FOR UPDATE;

  -- Determine next event type
  SELECT f.tipo_evento INTO v_last_event
  FROM fichajes f
  WHERE f.empleado_id = v_empleado_id AND f.fecha = v_today
  ORDER BY f.timestamp DESC LIMIT 1;

  v_next_tipo := CASE WHEN v_last_event = 'entrada' THEN 'salida' ELSE 'entrada' END;

  -- Insert fichaje
  INSERT INTO fichajes (
    empleado_id, nombre_empleado, fecha, timestamp, tipo_evento,
    metodo, user_agent, dispositivo, es_manual,
    latitud, longitud, ubicacion,
    kiosk_device_id, centro_id, centro_nombre
  ) VALUES (
    v_empleado_id, v_nombre, v_today, now(), v_next_tipo,
    'pin', p_user_agent, p_dispositivo, false,
    p_latitud, p_longitud, p_ubicacion,
    v_device_id, v_centro_id, v_centro_nombre
  );

  -- Auto-update employee's centro on ENTRADA when device has a centro
  IF v_next_tipo = 'entrada' AND v_centro_id IS NOT NULL THEN
    UPDATE empleados
    SET centro_trabajo = v_centro_nombre,
        centro_id = v_centro_id
    WHERE id = v_empleado_id
      AND (centro_id IS DISTINCT FROM v_centro_id);

    -- Record in employee_centro_history (one entry per employee+centro per day)
    INSERT INTO employee_centro_history (empleado_id, centro_id, centro_nombre, fecha)
    SELECT v_empleado_id, v_centro_id, v_centro_nombre, v_today
    WHERE NOT EXISTS (
      SELECT 1 FROM employee_centro_history ech
      WHERE ech.empleado_id = v_empleado_id
        AND ech.centro_id = v_centro_id
        AND ech.fecha = v_today
    );
  END IF;

  -- Update kiosk device last_seen
  IF v_device_id IS NOT NULL THEN
    UPDATE kiosk_devices SET last_seen_at = now() WHERE id = v_device_id;
  END IF;

  RETURN QUERY SELECT true, v_next_tipo, v_nombre, NULL::text;
END;
$function$;
