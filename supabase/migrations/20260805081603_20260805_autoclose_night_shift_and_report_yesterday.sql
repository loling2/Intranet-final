/*
# Cierre automático inteligente con turno de noche + informe del día anterior

## Cambios

### 1. `auto_close_open_fichajes()` — lógica de turno de noche
Reemplaza la función existente. NO cierra jornadas si la diferencia de tiempo
entre la entrada y ahora sugiere un turno de noche activo (ventana 7h-10h).

### 2. `send_daily_incidence_report()` — informe del DÍA ANTERIOR
Pasa `current_date - 1` como fecha a la Edge Function.

### Notas técnicas
- Se hace DROP + CREATE porque cambia el tipo de retorno de las funciones existentes.
- safe to re-run: DROP IF EXISTS + CREATE (no IF NOT EXISTS needed after DROP).
*/

-- ── 1. auto_close_open_fichajes ───────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.auto_close_open_fichajes();

CREATE FUNCTION public.auto_close_open_fichajes()
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
  -- Ventana de turno de noche: entre 7 y 10 horas desde la entrada → no cerrar
  c_night_min_hours CONSTANT numeric := 7;
  c_night_max_hours CONSTANT numeric := 10;
BEGIN
  FOR v_row IN
    SELECT DISTINCT ON (f.nombre_empleado, f.fecha)
      f.nombre_empleado,
      f.empleado_id,
      f.fecha,
      COALESCE(f.timestamp_corregido, f.timestamp) AS entrada_ts
    FROM fichajes f
    WHERE f.tipo_evento = 'entrada'
      AND NOT EXISTS (
        SELECT 1 FROM fichajes f2
        WHERE f2.nombre_empleado = f.nombre_empleado
          AND f2.fecha = f.fecha
          AND f2.tipo_evento = 'salida'
      )
    ORDER BY f.nombre_empleado, f.fecha, COALESCE(f.timestamp_corregido, f.timestamp) DESC
  LOOP
    v_entry_ts := v_row.entrada_ts;
    v_hours_since_entry := EXTRACT(EPOCH FROM (now() - v_entry_ts)) / 3600.0;

    -- Entrada de días anteriores (ayer o antes)
    IF v_row.fecha < current_date THEN
      -- Si estamos en ventana de turno de noche → puede salir hoy → NO cerrar
      IF v_hours_since_entry >= c_night_min_hours AND v_hours_since_entry <= c_night_max_hours THEN
        CONTINUE;
      END IF;
      -- Fuera de ventana (>10h o <7h con fecha de ayer) → cerrar

    -- Entrada de hoy
    ELSE
      IF v_hours_since_entry < c_night_min_hours THEN
        CONTINUE; -- Jornada normal en curso, menos de 7h → no cerrar
      ELSIF v_hours_since_entry <= c_night_max_hours THEN
        CONTINUE; -- Entre 7h y 10h → posible turno de noche → no cerrar
      END IF;
      -- Más de 10h desde entrada de hoy → cerrar automáticamente
    END IF;

    -- Insertar cierre automático a las 23:59:59 del día de la entrada
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

-- ── 2. send_daily_incidence_report (fecha = ayer) ─────────────────────────────

DROP FUNCTION IF EXISTS public.send_daily_incidence_report();

CREATE FUNCTION public.send_daily_incidence_report()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled text;
  v_supabase_url text;
  v_service_key text;
  v_report_date date := current_date - 1;  -- SIEMPRE el día anterior
BEGIN
  SELECT value INTO v_enabled FROM ui_settings WHERE key = 'incidence_report_enabled' LIMIT 1;
  IF v_enabled IS DISTINCT FROM 'true' THEN RETURN; END IF;

  SELECT value INTO v_supabase_url FROM ui_settings WHERE key = 'supabase_url' LIMIT 1;
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RAISE EXCEPTION 'supabase_url not set in ui_settings';
  END IF;

  BEGIN
    v_service_key := current_setting('app.settings.service_role_key');
  EXCEPTION WHEN OTHERS THEN
    BEGIN v_service_key := current_setting('app.service_role_key');
    EXCEPTION WHEN OTHERS THEN v_service_key := NULL; END;
  END;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/incidence-report',
    headers := CASE
      WHEN v_service_key IS NOT NULL THEN jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key,
        'apikey', v_service_key)
      ELSE jsonb_build_object('Content-Type', 'application/json')
    END,
    body := jsonb_build_object('date', v_report_date::text)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_daily_incidence_report() TO postgres;

-- Reschedule cron to 1 AM (01:00)
SELECT cron.unschedule('daily-incidence-report');
SELECT cron.schedule('daily-incidence-report', '0 1 * * *',
  $$SELECT public.send_daily_incidence_report();$$);
