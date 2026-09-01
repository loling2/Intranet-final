/* Auto-complete an open night shift when the first next-day clock is made. */

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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_nombre text;
  v_empleado_id uuid;
  v_fichaje_mode text;
  v_last_event text;
  v_last_event_at timestamptz;
  v_next_tipo text;
  v_device_id uuid;
  v_site_name text;
  v_centro_id uuid;
  v_centro_nombre text;
  v_is_kiosk boolean := false;
  v_is_corporate boolean := false;
BEGIN
  SELECT vp.id, vp.nombre INTO v_user_id, v_nombre
  FROM validate_vehicle_pin(p_pin) vp LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'PIN incorrecto'; RETURN;
  END IF;

  SELECT e.id, COALESCE(e.fichaje_mode, 'any') INTO v_empleado_id, v_fichaje_mode
  FROM empleados e WHERE e.user_id = v_user_id LIMIT 1;
  IF v_empleado_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, v_nombre, 'Empleado no encontrado'; RETURN;
  END IF;

  IF v_fichaje_mode = 'kiosk_only' THEN
    IF p_device_key IS NULL THEN RETURN QUERY SELECT false, NULL::text, v_nombre, 'DEVICE_NOT_AUTHORIZED'; RETURN; END IF;
    SELECT id, site_name, centro_id INTO v_device_id, v_site_name, v_centro_id
    FROM kiosk_devices WHERE device_key = p_device_key AND is_active = true LIMIT 1;
    IF v_device_id IS NULL THEN RETURN QUERY SELECT false, NULL::text, v_nombre, 'DEVICE_NOT_AUTHORIZED'; RETURN; END IF;
    v_is_kiosk := true;
  ELSIF v_fichaje_mode = 'kiosk_or_corporate' THEN
    IF p_device_key IS NULL THEN RETURN QUERY SELECT false, NULL::text, v_nombre, 'DEVICE_NOT_AUTHORIZED'; RETURN; END IF;
    SELECT id, site_name, centro_id INTO v_device_id, v_site_name, v_centro_id
    FROM kiosk_devices WHERE device_key = p_device_key AND is_active = true LIMIT 1;
    IF v_device_id IS NOT NULL THEN
      v_is_kiosk := true;
    ELSE
      SELECT id INTO v_device_id FROM employee_registered_devices
      WHERE device_key = p_device_key AND empleado_id = v_empleado_id AND is_active = true LIMIT 1;
      IF v_device_id IS NULL THEN RETURN QUERY SELECT false, NULL::text, v_nombre, 'DEVICE_NOT_AUTHORIZED'; RETURN; END IF;
      v_is_corporate := true;
    END IF;
  ELSE
    IF p_device_key IS NOT NULL THEN
      SELECT id, site_name, centro_id INTO v_device_id, v_site_name, v_centro_id
      FROM kiosk_devices WHERE device_key = p_device_key AND is_active = true LIMIT 1;
      IF v_device_id IS NOT NULL THEN v_is_kiosk := true; END IF;
    END IF;
  END IF;

  IF v_centro_id IS NOT NULL THEN
    SELECT c.nombre INTO v_centro_nombre FROM centros c WHERE c.id = v_centro_id LIMIT 1;
  END IF;

  PERFORM 1 FROM fichajes f WHERE f.empleado_id = v_empleado_id FOR UPDATE;

  SELECT f.tipo_evento, COALESCE(f.timestamp_corregido, f.timestamp)
  INTO v_last_event, v_last_event_at
  FROM fichajes f
  WHERE f.empleado_id = v_empleado_id
    AND f.tipo_evento IN ('entrada', 'salida')
  ORDER BY COALESCE(f.timestamp_corregido, f.timestamp) DESC, f.timestamp DESC
  LIMIT 1;

  IF v_last_event = 'entrada'
     AND v_last_event_at > now() - interval '16 hours' THEN
    v_next_tipo := 'salida';
  ELSE
    v_next_tipo := 'entrada';
  END IF;

  INSERT INTO fichajes (
    empleado_id, nombre_empleado, fecha, timestamp, tipo_evento,
    metodo, user_agent, dispositivo, es_manual, latitud, longitud, ubicacion,
    kiosk_device_id, centro_id, centro_nombre
  ) VALUES (
    v_empleado_id, v_nombre, current_date, now(), v_next_tipo,
    'pin', p_user_agent, COALESCE(p_dispositivo, p_device_key), false,
    p_latitud, p_longitud, p_ubicacion,
    CASE WHEN v_is_kiosk THEN v_device_id ELSE NULL END,
    v_centro_id, COALESCE(v_centro_nombre, v_site_name)
  );

  IF v_next_tipo = 'entrada' AND v_centro_id IS NOT NULL THEN
    UPDATE empleados SET centro_trabajo = v_centro_nombre, centro_id = v_centro_id
    WHERE id = v_empleado_id AND centro_id IS DISTINCT FROM v_centro_id;
    INSERT INTO employee_centro_history (empleado_id, centro_id, centro_nombre, fecha)
    SELECT v_empleado_id, v_centro_id, v_centro_nombre, current_date
    WHERE NOT EXISTS (
      SELECT 1 FROM employee_centro_history ech
      WHERE ech.empleado_id = v_empleado_id AND ech.centro_id = v_centro_id AND ech.fecha = current_date
    );
  END IF;

  IF v_is_kiosk AND v_device_id IS NOT NULL THEN
    UPDATE kiosk_devices SET last_seen_at = now() WHERE id = v_device_id;
  ELSIF v_is_corporate AND v_device_id IS NOT NULL THEN
    UPDATE employee_registered_devices SET last_seen_at = now() WHERE id = v_device_id;
  END IF;

  RETURN QUERY SELECT true, v_next_tipo, v_nombre, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_register_fichaje(text, double precision, double precision, text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.web_register_fichaje(
  p_tipo_evento text,
  p_latitud double precision DEFAULT NULL,
  p_longitud double precision DEFAULT NULL,
  p_ubicacion text DEFAULT NULL,
  p_dispositivo text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_device_key text DEFAULT NULL,
  p_es_manual boolean DEFAULT false,
  p_nota_correccion text DEFAULT NULL,
  p_pin text DEFAULT NULL
)
RETURNS TABLE(success boolean, tipo text, nombre_empleado text, error_msg text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_nombre text;
  v_empleado_id uuid;
  v_fichaje_mode text;
  v_last_event text;
  v_last_event_at timestamptz;
  v_next_tipo text;
  v_device_id uuid;
  v_is_kiosk boolean := false;
  v_is_corporate boolean := false;
  v_centro_id uuid;
  v_centro_nombre text;
BEGIN
  IF v_user_id IS NULL AND p_pin IS NOT NULL AND p_pin <> '' THEN
    SELECT vp.id, vp.nombre INTO v_user_id, v_nombre FROM validate_vehicle_pin(p_pin) vp LIMIT 1;
    IF v_user_id IS NULL THEN RETURN QUERY SELECT false, NULL::text, NULL::text, 'PIN_INCORRECTO'; RETURN; END IF;
  END IF;
  IF v_user_id IS NULL THEN RETURN QUERY SELECT false, NULL::text, NULL::text, 'No autenticado'; RETURN; END IF;

  SELECT e.id, e.nombre, COALESCE(e.fichaje_mode, 'kiosk_only')
  INTO v_empleado_id, v_nombre, v_fichaje_mode
  FROM empleados e WHERE e.user_id = v_user_id LIMIT 1;
  IF v_empleado_id IS NULL THEN
    SELECT up.nombre INTO v_nombre FROM user_profiles up WHERE up.id = v_user_id LIMIT 1;
    IF v_nombre IS NULL THEN RETURN QUERY SELECT false, NULL::text, NULL::text, 'Empleado no encontrado'; RETURN; END IF;
  END IF;

  IF v_fichaje_mode = 'any' THEN
    IF p_device_key IS NOT NULL THEN
      SELECT id, centro_id INTO v_device_id, v_centro_id FROM kiosk_devices
      WHERE device_key = p_device_key AND is_active = true LIMIT 1;
      IF v_device_id IS NOT NULL THEN v_is_kiosk := true; END IF;
    END IF;
  ELSIF v_fichaje_mode = 'kiosk_only' THEN
    IF p_device_key IS NULL THEN RETURN QUERY SELECT false, NULL::text, v_nombre, 'DEVICE_NOT_AUTHORIZED'; RETURN; END IF;
    SELECT id, centro_id INTO v_device_id, v_centro_id FROM kiosk_devices
    WHERE device_key = p_device_key AND is_active = true LIMIT 1;
    IF v_device_id IS NULL THEN RETURN QUERY SELECT false, NULL::text, v_nombre, 'DEVICE_NOT_AUTHORIZED'; RETURN; END IF;
    v_is_kiosk := true;
  ELSIF v_fichaje_mode = 'kiosk_or_corporate' THEN
    IF p_device_key IS NULL THEN RETURN QUERY SELECT false, NULL::text, v_nombre, 'DEVICE_NOT_AUTHORIZED'; RETURN; END IF;
    SELECT id, centro_id INTO v_device_id, v_centro_id FROM kiosk_devices
    WHERE device_key = p_device_key AND is_active = true LIMIT 1;
    IF v_device_id IS NOT NULL THEN
      v_is_kiosk := true;
    ELSE
      SELECT id INTO v_device_id FROM employee_registered_devices
      WHERE device_key = p_device_key AND empleado_id = v_empleado_id AND is_active = true LIMIT 1;
      IF v_device_id IS NULL THEN RETURN QUERY SELECT false, NULL::text, v_nombre, 'DEVICE_NOT_AUTHORIZED'; RETURN; END IF;
      v_is_corporate := true;
    END IF;
  END IF;

  IF v_centro_id IS NOT NULL THEN SELECT c.nombre INTO v_centro_nombre FROM centros c WHERE c.id = v_centro_id LIMIT 1; END IF;
  IF p_tipo_evento = 'entrada' AND p_es_manual = false AND (p_latitud IS NULL OR p_longitud IS NULL) AND p_ubicacion IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, v_nombre, 'LOCATION_REQUIRED'; RETURN;
  END IF;

  PERFORM 1 FROM fichajes f WHERE f.empleado_id = v_empleado_id FOR UPDATE;
  SELECT f.tipo_evento, COALESCE(f.timestamp_corregido, f.timestamp)
  INTO v_last_event, v_last_event_at
  FROM fichajes f WHERE f.empleado_id = v_empleado_id AND f.tipo_evento IN ('entrada', 'salida')
  ORDER BY COALESCE(f.timestamp_corregido, f.timestamp) DESC, f.timestamp DESC LIMIT 1;

  v_next_tipo := p_tipo_evento;
  IF p_tipo_evento = 'entrada' AND v_last_event = 'entrada' AND v_last_event_at > now() - interval '16 hours' THEN
    v_next_tipo := 'salida';
  ELSIF (p_tipo_evento IS NULL OR p_tipo_evento = '') THEN
    v_next_tipo := CASE WHEN v_last_event = 'entrada' THEN 'salida' ELSE 'entrada' END;
  END IF;

  INSERT INTO fichajes (
    empleado_id, nombre_empleado, fecha, timestamp, tipo_evento, metodo, user_agent,
    dispositivo, es_manual, latitud, longitud, ubicacion, kiosk_device_id,
    centro_id, centro_nombre, nota_correccion
  ) VALUES (
    v_empleado_id, v_nombre, current_date, now(), v_next_tipo, 'web', p_user_agent,
    COALESCE(p_dispositivo, p_device_key), p_es_manual, p_latitud, p_longitud, p_ubicacion,
    CASE WHEN v_is_kiosk THEN v_device_id ELSE NULL END,
    v_centro_id, v_centro_nombre, p_nota_correccion
  );

  IF v_next_tipo = 'entrada' AND v_centro_id IS NOT NULL THEN
    UPDATE empleados SET centro_trabajo = v_centro_nombre, centro_id = v_centro_id
    WHERE id = v_empleado_id AND centro_id IS DISTINCT FROM v_centro_id;
    INSERT INTO employee_centro_history (empleado_id, centro_id, centro_nombre, fecha)
    SELECT v_empleado_id, v_centro_id, v_centro_nombre, current_date
    WHERE NOT EXISTS (
      SELECT 1 FROM employee_centro_history ech
      WHERE ech.empleado_id = v_empleado_id AND ech.centro_id = v_centro_id AND ech.fecha = current_date
    );
  END IF;

  IF v_is_kiosk AND v_device_id IS NOT NULL THEN UPDATE kiosk_devices SET last_seen_at = now() WHERE id = v_device_id;
  ELSIF v_is_corporate AND v_device_id IS NOT NULL THEN UPDATE employee_registered_devices SET last_seen_at = now() WHERE id = v_device_id;
  END IF;

  RETURN QUERY SELECT true, v_next_tipo, v_nombre, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.web_register_fichaje(text, double precision, double precision, text, text, text, text, boolean, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kiosk_get_next_fichaje_tipo(p_pin text)
RETURNS TABLE(empleado_id uuid, nombre_empleado text, tipo text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_nombre text;
  v_last_event text;
  v_last_event_at timestamptz;
BEGIN
  SELECT vp.id, vp.nombre INTO v_user_id, v_nombre FROM validate_vehicle_pin(p_pin) vp LIMIT 1;
  IF v_user_id IS NULL THEN RETURN; END IF;
  SELECT e.id INTO empleado_id FROM empleados e WHERE e.user_id = v_user_id LIMIT 1;
  nombre_empleado := v_nombre;
  SELECT f.tipo_evento, COALESCE(f.timestamp_corregido, f.timestamp)
  INTO v_last_event, v_last_event_at
  FROM fichajes f
  WHERE f.nombre_empleado = v_nombre AND f.tipo_evento IN ('entrada', 'salida')
  ORDER BY COALESCE(f.timestamp_corregido, f.timestamp) DESC, f.timestamp DESC LIMIT 1;
  tipo := CASE WHEN v_last_event = 'entrada' AND v_last_event_at > now() - interval '16 hours' THEN 'salida' ELSE 'entrada' END;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_get_next_fichaje_tipo(text) TO anon, authenticated;
