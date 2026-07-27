/*
# Fix kiosk_get_next_fichaje_tipo function (v2)

Rewrote the function to match the actual return shape of
validate_vehicle_pin (returns TABLE(id uuid, nombre text)).
Uses OUT-parameter-style RETURN NEXT (no explicit args).
*/

CREATE OR REPLACE FUNCTION public.kiosk_get_next_fichaje_tipo(p_pin text)
RETURNS TABLE (
  empleado_id uuid,
  nombre_empleado text,
  tipo text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_nombre text;
  v_today date := current_date;
  v_last_event text;
BEGIN
  -- Validate PIN
  SELECT vp.id, vp.nombre INTO v_user_id, v_nombre
  FROM validate_vehicle_pin(p_pin) vp
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Find the employee record
  SELECT e.id INTO empleado_id
  FROM empleados e
  WHERE e.user_id = v_user_id
  LIMIT 1;

  nombre_empleado := v_nombre;

  -- Look up today's last fichaje event for this employee
  SELECT f.tipo_evento INTO v_last_event
  FROM fichajes f
  WHERE f.nombre_empleado = v_nombre
    AND f.fecha = v_today
  ORDER BY f.timestamp DESC
  LIMIT 1;

  -- Alternate: if last was 'entrada' → 'salida', otherwise 'entrada'
  IF v_last_event = 'entrada' THEN
    tipo := 'salida';
  ELSE
    tipo := 'entrada';
  END IF;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_get_next_fichaje_tipo(text) TO anon, authenticated;
