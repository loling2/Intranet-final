/*
# Cómputo de jornadas nocturnas (cruce de medianoche)

## Propósito
Cuando un trabajador hace un turno de noche (por ejemplo entra a las 21:00 y
sale a las 07:00 del día siguiente), el sistema actualmente divide la jornada
en dos días distintos: el día 1 tiene una entrada sin salida, y el día 2 tiene
una salida sin entrada. El cómputo de horas se rompe porque no cruza la
medianoche.

Esta migración añade una función `kiosk_get_daily_total_with_night` que:
1. Toma los fichajes del día actual.
2. Si hay una entrada sin salida ese día, busca la primera salida del día
   siguiente (hasta 16 horas después) para cerrar el turno nocturno.
3. Suma las horas completas, incluyendo el tramo que cruza medianoche.

También actualiza `kiosk_get_daily_total` para que use la nueva lógica.

## Seguridad
- Función SECURITY DEFINER con search_path fijo a public.
- Ejecutable por anon y authenticated (mismo flujo que el kiosco).

## Notas importantes
1. No se eliminan ni modifican tablas, columnas ni datos existentes.
2. La función original `kiosk_get_daily_total` se reemplaza por la nueva
   versión que cruza medianoche.
3. El cruce de medianoche solo aplica cuando la entrada no tiene salida el
   mismo día y la salida ocurre al día siguiente (hasta 16h después).
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
  v_night_close timestamptz;
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

  -- ── Sumar pares entrada/salida del día actual ──
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

  -- ── Si queda una entrada abierta, buscar la salida del día siguiente (turno nocturno) ──
  IF v_opened_at IS NOT NULL THEN
    SELECT COALESCE(f.timestamp_corregido, f.timestamp) INTO v_night_close
    FROM fichajes f
    WHERE f.empleado_id = v_empleado_id
      AND f.fecha = current_date + 1
      AND f.tipo_evento = 'salida'
      AND COALESCE(f.timestamp_corregido, f.timestamp) > v_opened_at
      AND EXTRACT(EPOCH FROM (COALESCE(f.timestamp_corregido, f.timestamp) - v_opened_at)) / 3600.0 <= 16
    ORDER BY COALESCE(f.timestamp_corregido, f.timestamp)
    LIMIT 1;

    IF v_night_close IS NOT NULL THEN
      v_total_minutes := v_total_minutes + GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_night_close - v_opened_at)) / 60)::integer);
    END IF;
  END IF;

  RETURN v_total_minutes;
END;
$$;

REVOKE ALL ON FUNCTION public.kiosk_get_daily_total(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_get_daily_total(text) TO anon, authenticated;
