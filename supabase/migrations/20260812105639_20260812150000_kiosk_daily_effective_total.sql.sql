/*
# Kiosco: total diario de horas efectivas

1. Purpose
- Provide the kiosk with the accumulated effective work time after a departure is recorded.
- Sum every completed entrada/salida pair from the current day, including days with multiple work periods.

2. New database function
- `public.kiosk_get_daily_total(p_pin text)` returns the total completed minutes for the employee identified by the PIN.
- An entrada opens a work period and the next salida closes it. Unclosed entradas are not counted.

3. Security
- The function runs as SECURITY DEFINER with a fixed `public` search path.
- Execution is limited to the kiosk's existing anon and authenticated roles, matching the existing PIN registration flow.

4. Important notes
- No tables, columns, or existing fichajes are removed or changed.
- Only completed entrada/salida pairs are included in the total.
*/

CREATE OR REPLACE FUNCTION public.kiosk_get_daily_total(p_pin text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_empleado_id uuid;
  v_opened_at timestamptz;
  v_total_minutes integer := 0;
  v_event record;
BEGIN
  SELECT vp.id INTO v_user_id
  FROM validate_vehicle_pin(p_pin) vp
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT e.id INTO v_empleado_id
  FROM empleados e
  WHERE e.user_id = v_user_id
  LIMIT 1;

  IF v_empleado_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_event IN
    SELECT f.tipo_evento, COALESCE(f.timestamp_corregido, f.timestamp) AS event_time
    FROM fichajes f
    WHERE f.empleado_id = v_empleado_id
      AND f.fecha = current_date
      AND f.tipo_evento IN ('entrada', 'salida')
    ORDER BY COALESCE(f.timestamp_corregido, f.timestamp), f.timestamp
  LOOP
    IF v_event.tipo_evento = 'entrada' THEN
      IF v_opened_at IS NULL THEN
        v_opened_at := v_event.event_time;
      END IF;
    ELSIF v_opened_at IS NOT NULL THEN
      v_total_minutes := v_total_minutes + GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_event.event_time - v_opened_at)) / 60)::integer);
      v_opened_at := NULL;
    END IF;
  END LOOP;

  RETURN v_total_minutes;
END;
$$;

REVOKE ALL ON FUNCTION public.kiosk_get_daily_total(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_get_daily_total(text) TO anon, authenticated;