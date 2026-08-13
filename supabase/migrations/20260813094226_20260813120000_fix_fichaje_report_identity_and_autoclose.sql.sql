/*
# Corregir identidad de fichajes y cierres automáticos

1. Problema corregido
- Los cierres automáticos y la alternancia de fichajes comparaban el nombre escrito, aunque el identificador del empleado era el mismo.
- Esto provocaba que una salida real guardada con otro orden de nombre pareciera inexistente.
- El disparador de protección reemplazaba la hora calculada del cierre automático por la hora en la que se ejecutaba el cron.

2. Cambios
- `auto_close_open_fichajes()` identifica la jornada por `empleado_id` y conserva el cierre en las 23:59:59 del día correspondiente.
- `check_fichaje_alternation()` identifica el último evento por `empleado_id`.
- `protect_fichaje_timestamp()` conserva únicamente las horas generadas por el cierre automático interno mediante una marca de transacción; el resto de inserciones siguen usando la hora del servidor.

3. Seguridad y datos
- No se eliminan ni modifican registros existentes.
- No se cambian tablas, columnas ni permisos.
- La marca interna solo vive durante la transacción del cierre automático.
*/

CREATE OR REPLACE FUNCTION public.protect_fichaje_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF current_setting('app.auto_close_fichaje', true) IS DISTINCT FROM 'on' THEN
      NEW.timestamp := clock_timestamp();
    END IF;
  ELSE
    NEW.timestamp := OLD.timestamp;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_fichaje_alternation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_tipo text;
BEGIN
  IF NEW.tipo_evento NOT IN ('entrada', 'salida') OR NEW.es_manual THEN
    RETURN NEW;
  END IF;

  SELECT f.tipo_evento INTO v_last_tipo
  FROM public.fichajes f
  WHERE f.fecha = NEW.fecha
    AND f.tipo_evento IN ('entrada', 'salida')
    AND (
      (NEW.empleado_id IS NOT NULL AND f.empleado_id = NEW.empleado_id)
      OR (NEW.empleado_id IS NULL AND f.empleado_id IS NULL AND f.nombre_empleado = NEW.nombre_empleado)
    )
  ORDER BY f.timestamp DESC
  LIMIT 1;

  IF v_last_tipo = NEW.tipo_evento THEN
    IF NEW.tipo_evento = 'entrada' THEN
      RAISE EXCEPTION 'Ya existe una entrada registrada hoy. Debes fichar la salida antes de registrar una nueva entrada.';
    ELSE
      RAISE EXCEPTION 'No hay una entrada activa. Debes fichar la entrada antes de registrar la salida.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_close_open_fichajes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_close_ts timestamptz;
  v_entry_ts timestamptz;
  v_hours_since_entry numeric;
  c_night_min_hours CONSTANT numeric := 7;
  c_night_max_hours CONSTANT numeric := 10;
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

    IF v_row.fecha < current_date THEN
      IF v_hours_since_entry >= c_night_min_hours AND v_hours_since_entry <= c_night_max_hours THEN
        CONTINUE;
      END IF;
    ELSE
      IF v_hours_since_entry <= c_night_max_hours THEN
        CONTINUE;
      END IF;
    END IF;

    v_close_ts := (v_row.fecha::timestamp + interval '23 hours 59 minutes 59 seconds')
      AT TIME ZONE 'Atlantic/Canary';

    INSERT INTO fichajes (
      empleado_id, nombre_empleado, fecha, timestamp, tipo_evento,
      metodo, es_manual, nota_correccion
    ) VALUES (
      v_row.empleado_id, v_row.nombre_empleado, v_row.fecha, v_close_ts,
      'salida', 'sistema', false,
      'Cierre automático del sistema (23:59:59). El trabajador no registró la salida. Pendiente de corrección.'
    );
  END LOOP;
END;
$$;
