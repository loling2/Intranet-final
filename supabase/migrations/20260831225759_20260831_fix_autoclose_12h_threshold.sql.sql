/*
# Fix: Cierre automático solo tras 12 horas (no 10)

## Problem
- La función auto_close_open_fichajes() usa umbrales de 7h y 10h.
- El usuario solicita: no cerrar si la jornada no llega a 8h, y solo cerrar
  si han pasado más de 12h desde la entrada, a las 23:59 del día de entrada.

## New logic
- Si han pasado <= 12 horas desde la entrada → NO cerrar (jornada en curso,
  incluyendo turno de noche).
- Si han pasado > 12 horas desde la entrada → cerrar a 23:59 del día de entrada.
- Esto unifica el comportamiento para hoy y días anteriores.

## Changes
- c_min_hours_before_close = 12 (antes 7/10 según caso)
- Se elimina la distinción entre "hoy" y "días anteriores" porque la regla
  del usuario es uniforme: > 12h → cerrar.
- El cierre sigue siendo a 23:59:59 del día de la entrada (Atlantic/Canary).
- Seguridad: SECURITY DEFINER, search_path = public.
*/

CREATE OR REPLACE FUNCTION public.auto_close_open_fichajes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_close_ts timestamptz;
  v_entry_ts timestamptz;
  v_hours_since_entry numeric;
  c_min_hours CONSTANT numeric := 12;
BEGIN
  PERFORM set_config('app.auto_close_fichaje', 'on', true);

  FOR v_row IN
    SELECT DISTINCT ON (f.empleado_id, f.fecha)
      f.empleado_id,
      f.nombre_empleado,
      f.fecha,
      COALESCE(f.timestamp_corregido, f.timestamp) AS entrada_ts
    FROM fichajes f
    WHERE f.tipo_evento = 'entrada'
      AND f.empleado_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM fichajes f2
        WHERE f2.empleado_id = f.empleado_id
          AND f2.fecha = f.fecha
          AND f2.tipo_evento = 'salida'
      )
    ORDER BY f.empleado_id, f.fecha, COALESCE(f.timestamp_corregido, f.timestamp) DESC
  LOOP
    v_entry_ts := v_row.entrada_ts;
    v_hours_since_entry := EXTRACT(EPOCH FROM (now() - v_entry_ts)) / 3600.0;

    -- Solo cerrar si han pasado más de 12 horas desde la entrada
    IF v_hours_since_entry <= c_min_hours THEN
      CONTINUE;
    END IF;

    -- Cierre a 23:59:59 del día de la entrada (zona Atlantic/Canary)
    v_close_ts := (v_row.fecha::timestamp + interval '23 hours 59 minutes 59 seconds')
                  AT TIME ZONE 'Atlantic/Canary' AT TIME ZONE 'UTC';

    INSERT INTO fichajes (
      empleado_id,
      nombre_empleado,
      fecha,
      timestamp,
      tipo_evento,
      metodo,
      es_manual,
      nota_correccion
    ) VALUES (
      v_row.empleado_id,
      v_row.nombre_empleado,
      v_row.fecha,
      v_close_ts,
      'salida',
      'sistema',
      false,
      'Cierre automático del sistema (23:59:59). El trabajador no registró la salida. Pendiente de corrección.'
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_close_open_fichajes() TO postgres;
