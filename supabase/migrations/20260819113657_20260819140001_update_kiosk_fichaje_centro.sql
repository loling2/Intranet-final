/*
# Update kiosk_register_fichaje: auto-update employee centro + accumulate history

## Summary
Updates the `kiosk_register_fichaje` SECURITY DEFINER function so that when an
employee clocks in at a kiosk tablet that is linked to a centro, the system:
1. Updates the employee's `centro_trabajo` and `centro_id` to the new center.
2. Records the rotation in `employee_centro_history` (if not already recorded
   for that center + employee combination today).

This enables the "movilidad multicentro" requirement: the employee's main center
follows the last tablet where they clocked in, while the history accumulates all
centers they have rotated through so PRL document access is preserved.
*/

CREATE OR REPLACE FUNCTION public.kiosk_register_fichaje(
  p_pin text,
  p_latitud double precision DEFAULT NULL,
  p_longitud double precision DEFAULT NULL,
  p_ubicacion text DEFAULT NULL,
  p_dispositivo text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS TABLE(success boolean, tipo text, nombre_empleado text, error_msg text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_nombre text;
  v_empleado_id uuid;
  v_today date := current_date;
  v_last_event text;
  v_next_tipo text;
  v_device_id uuid;
  v_centro_id uuid;
  v_centro_nombre text;
BEGIN
  -- Validate PIN
  SELECT vp.id, vp.nombre INTO v_user_id, v_nombre
  FROM validate_vehicle_pin(p_pin) vp
  LIMIT 1;

  IF v_user_id IS NULL THEN
    success := false; tipo := NULL; nombre_empleado := NULL; error_msg := 'PIN incorrecto';
    RETURN NEXT; RETURN;
  END IF;

  -- Find the employee record
  SELECT e.id INTO v_empleado_id
  FROM empleados e
  WHERE e.user_id = v_user_id
  LIMIT 1;

  nombre_empleado := v_nombre;

  IF v_empleado_id IS NULL THEN
    success := false; tipo := NULL; nombre_empleado := v_nombre; error_msg := 'Empleado no encontrado';
    RETURN NEXT; RETURN;
  END IF;

  -- Look up the kiosk device by device key if p_dispositivo contains it
  -- The kiosk passes its device_key via p_dispositivo in the format "site_name · device_info"
  -- We try to find the kiosk device by matching site_name
  SELECT kd.id, kd.centro_id INTO v_device_id, v_centro_id
  FROM kiosk_devices kd
  WHERE kd.is_active = true
    AND kd.site_name = split_part(COALESCE(p_dispositivo, ''), ' · ', 1)
  LIMIT 1;

  -- If we found a centro from the device, get its name
  IF v_centro_id IS NOT NULL THEN
    SELECT c.nombre INTO v_centro_nombre FROM centros c WHERE c.id = v_centro_id LIMIT 1;
  END IF;

  -- Lock this employee's fichaje rows for today to prevent concurrent inserts
  PERFORM 1 FROM fichajes f
  WHERE f.nombre_empleado = v_nombre AND f.fecha = v_today
  FOR UPDATE;

  -- Look up today's last fichaje event for this employee
  SELECT f.tipo_evento INTO v_last_event
  FROM fichajes f
  WHERE f.nombre_empleado = v_nombre AND f.fecha = v_today
  ORDER BY f.timestamp DESC LIMIT 1;

  IF v_last_event = 'entrada' THEN
    v_next_tipo := 'salida';
  ELSE
    v_next_tipo := 'entrada';
  END IF;

  tipo := v_next_tipo;

  BEGIN
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

    -- Auto-update employee's centro_trabajo and centro_id on ENTRADA
    -- Only update if we found a centro from the kiosk device and it differs
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

  EXCEPTION WHEN OTHERS THEN
    success := false; error_msg := SQLERRM;
    RETURN NEXT; RETURN;
  END;

  -- Update kiosk device last_seen
  IF v_device_id IS NOT NULL THEN
    UPDATE kiosk_devices SET last_seen_at = now() WHERE id = v_device_id;
  END IF;

  success := true; error_msg := NULL;
  RETURN NEXT;
END;
$function$;
