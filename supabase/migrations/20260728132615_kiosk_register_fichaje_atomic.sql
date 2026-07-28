-- Atomic fichaje registration: determines next tipo AND inserts in one call.
-- This eliminates the race condition where two rapid PIN submissions both
-- read "no previous fichaje" and both register as 'entrada'.

CREATE OR REPLACE FUNCTION public.kiosk_register_fichaje(
  p_pin text,
  p_latitud double precision DEFAULT NULL,
  p_longitud double precision DEFAULT NULL,
  p_ubicacion text DEFAULT NULL,
  p_dispositivo text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  tipo text,
  nombre_empleado text,
  error_msg text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_nombre text;
  v_empleado_id uuid;
  v_today date := current_date;
  v_last_event text;
  v_next_tipo text;
BEGIN
  -- Validate PIN
  SELECT vp.id, vp.nombre INTO v_user_id, v_nombre
  FROM validate_vehicle_pin(p_pin) vp
  LIMIT 1;

  IF v_user_id IS NULL THEN
    success := false;
    tipo := NULL;
    nombre_empleado := NULL;
    error_msg := 'PIN incorrecto';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Find the employee record
  SELECT e.id INTO v_empleado_id
  FROM empleados e
  WHERE e.user_id = v_user_id
  LIMIT 1;

  nombre_empleado := v_nombre;

  -- Lock this employee's fichaje rows for today to prevent concurrent inserts
  -- from both reading the same "last event" state.
  PERFORM 1 FROM fichajes f
  WHERE f.nombre_empleado = v_nombre
    AND f.fecha = v_today
  FOR UPDATE;

  -- Look up today's last fichaje event for this employee
  SELECT f.tipo_evento INTO v_last_event
  FROM fichajes f
  WHERE f.nombre_empleado = v_nombre
    AND f.fecha = v_today
  ORDER BY f.timestamp DESC
  LIMIT 1;

  -- Determine next type: only 'entrada' → 'salida', everything else → 'entrada'
  IF v_last_event = 'entrada' THEN
    v_next_tipo := 'salida';
  ELSE
    v_next_tipo := 'entrada';
  END IF;

  tipo := v_next_tipo;

  -- Insert the fichaje atomically within this transaction
  INSERT INTO fichajes (
    empleado_id,
    nombre_empleado,
    fecha,
    timestamp,
    tipo_evento,
    metodo,
    user_agent,
    dispositivo,
    es_manual,
    latitud,
    longitud,
    ubicacion
  ) VALUES (
    v_empleado_id,
    v_nombre,
    v_today,
    now(),
    v_next_tipo,
    'pin',
    p_user_agent,
    p_dispositivo,
    false,
    p_latitud,
    p_longitud,
    p_ubicacion
  );

  success := true;
  error_msg := NULL;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_register_fichaje(text, double precision, double precision, text, text, text) TO anon, authenticated;
