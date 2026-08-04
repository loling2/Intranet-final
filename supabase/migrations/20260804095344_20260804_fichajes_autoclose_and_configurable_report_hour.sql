/*
# Cierre automático de fichajes y hora configurable del informe de incidencias

1. auto_close_open_fichajes(): inserta salida a 23:59:59 Canarias para empleados
   sin salida. Cron a las 23:55.
2. reschedule_incidence_report(p_hour): reprograma el cron del informe.
3. Setting incidence_report_hour en ui_settings.
*/

-- ── 1. Función de cierre automático ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_close_open_fichajes()
RETURNS TABLE (empleado_cerrado text, fecha_cerrada date, cierre_ts timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_close_ts timestamptz;
BEGIN
  FOR v_row IN
    SELECT DISTINCT f.nombre_empleado, f.empleado_id, f.fecha
    FROM fichajes f
    WHERE f.tipo_evento = 'entrada'
      AND f.fecha <= current_date
      AND NOT EXISTS (
        SELECT 1
        FROM fichajes f2
        WHERE f2.nombre_empleado = f.nombre_empleado
          AND f2.fecha = f.fecha
          AND f2.tipo_evento = 'salida'
      )
    ORDER BY f.fecha, f.nombre_empleado
  LOOP
    v_close_ts := (v_row.fecha::timestamp + interval '23 hours 59 minutes 59 seconds')
                  AT TIME ZONE 'Atlantic/Canary';

    INSERT INTO fichajes (
      empleado_id, nombre_empleado, fecha, "timestamp",
      tipo_evento, metodo, es_manual, nota_correccion
    ) VALUES (
      v_row.empleado_id, v_row.nombre_empleado, v_row.fecha, v_close_ts,
      'salida', 'auto', false,
      'Cierre automático del sistema (23:59:59). El trabajador no registró la salida. Pendiente de corrección.'
    );

    empleado_cerrado := v_row.nombre_empleado;
    fecha_cerrada    := v_row.fecha;
    cierre_ts        := v_close_ts;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ── 2. Función para reprogramar el informe de incidencias ────────────────────

CREATE OR REPLACE FUNCTION public.reschedule_incidence_report(p_hour int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cron_expr text;
BEGIN
  IF p_hour < 0 OR p_hour > 23 THEN
    RAISE EXCEPTION 'Hora no válida: debe estar entre 0 y 23';
  END IF;

  PERFORM cron.unschedule('daily-incidence-report');

  v_cron_expr := '0 ' || p_hour::text || ' * * *';

  PERFORM cron.schedule(
    'daily-incidence-report',
    v_cron_expr,
    'SELECT public.send_daily_incidence_report()'
  );

  INSERT INTO ui_settings (key, value)
  VALUES ('incidence_report_hour', p_hour::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$$;

-- ── 3. Setting por defecto ────────────────────────────────────────────────────

INSERT INTO ui_settings (key, value)
VALUES ('incidence_report_hour', '22')
ON CONFLICT (key) DO NOTHING;

-- ── 4. Cron de cierre automático a las 23:55 ─────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-close-fichajes') THEN
    PERFORM cron.unschedule('auto-close-fichajes');
  END IF;
END;
$$;

SELECT cron.schedule(
  'auto-close-fichajes',
  '55 23 * * *',
  'SELECT public.auto_close_open_fichajes()'
);
