/*
# Daily fichaje incidence report email

## Purpose
Every night at 22:00 (server time), the system automatically sends an
email with the day's fichaje incidencias: employees who worked less
than 6 hours (déficit) or more than 8 hours (exceso). This saves RRHH
from having to manually open the fichajes module to spot problems.

## How it works
1. `pg_cron` extension is enabled for job scheduling.
2. `pg_net` extension is enabled for making HTTP requests from SQL.
3. A SQL function `send_daily_incidence_report()` computes the day's
   incidencias using the same thresholds as the frontend (<6h déficit,
   >8h exceso), builds an HTML email body, and sends it by calling the
   existing `send-email` edge function via `pg_net`.
4. A `pg_cron` job runs `send_daily_incidence_report()` every night
   at 22:00.
5. The recipient email and on/off toggle are stored in `ui_settings`
   under keys `incidence_report_email` and `incidence_report_enabled`,
   with sensible defaults.

## Configuration
- Recipient: stored in `ui_settings` key `incidence_report_email`.
  Default: the email of the first active admin user.
- Enabled: stored in `ui_settings` key `incidence_report_enabled`.
  Default: true.

## Security
- No new tables. `pg_cron` and `pg_net` are installed in the `extensions`
  schema (Supabase default).
- The cron job runs as the `postgres` role (superuser) which is required
  for pg_cron. The function is SECURITY DEFINER so it can read fichajes
  and call pg_net.
- No RLS changes.
*/

-- ── 1. Enable extensions ──────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ── 2. Helper: get/set a ui_settings value ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_ui_setting(p_key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM ui_settings WHERE key = p_key LIMIT 1;
$$;

-- ── 3. Main function: compute incidencias and send email ─────────────────────
CREATE OR REPLACE FUNCTION public.send_daily_incidence_report()
RETURNS TABLE (success boolean, total_incidencias int, error_msg text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_enabled text;
  v_recipient text;
  v_supabase_url text;
  v_anon_key text;
  v_service_key text;
  v_cuenta_id uuid;
  v_plantilla_id uuid;
  v_today date := current_date;
  v_count int;
  v_html text;
  v_subject text;
  v_request_id bigint;
  v_row record;
  v_rows text := '';
BEGIN
  -- Check if enabled
  v_enabled := public.get_ui_setting('incidence_report_enabled');
  IF v_enabled IS NULL THEN
    v_enabled := 'true';
  END IF;
  IF v_enabled = 'false' THEN
    success := true;
    total_incidencias := 0;
    error_msg := 'Disabled';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Get recipient
  v_recipient := public.get_ui_setting('incidence_report_email');
  IF v_recipient IS NULL OR v_recipient = '' THEN
    -- Default to first admin email
    SELECT up.email INTO v_recipient
    FROM user_profiles up
    WHERE up.role = 'admin'
    ORDER BY up.created_at
    LIMIT 1;
  END IF;

  IF v_recipient IS NULL OR v_recipient = '' THEN
    success := false;
    total_incidencias := 0;
    error_msg := 'No recipient email configured';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Get env vars
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_anon_key := current_setting('app.settings.supabase_anon_key', true);
  v_service_key := current_setting('app.settings.supabase_service_role_key', true);

  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    success := false;
    total_incidencias := 0;
    error_msg := 'Missing env vars';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Get active SMTP account
  SELECT ec.id INTO v_cuenta_id FROM email_cuentas ec WHERE ec.activo = true LIMIT 1;
  IF v_cuenta_id IS NULL THEN
    success := false;
    total_incidencias := 0;
    error_msg := 'No active SMTP account';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Get or create a plantilla for incidence reports
  SELECT ep.id INTO v_plantilla_id FROM email_plantillas ep WHERE ep.nombre = 'Informe Diario de Incidencias' LIMIT 1;
  IF v_plantilla_id IS NULL THEN
    INSERT INTO email_plantillas (nombre, asunto, cuerpo, activo, tipo)
    VALUES (
      'Informe Diario de Incidencias',
      'Informe Diario de Incidencias - {{fecha}}',
      'Resumen de incidencias de fichaje del dia {{fecha}}.',
      true,
      'incidence_report'
    )
    RETURNING id INTO v_plantilla_id;
  END IF;

  -- ── Compute incidencias for today ──────────────────────────────────────────
  -- Same logic as frontend: first entrada → last salida, duration in minutes.
  -- Incident if duration < 360 min (6h) or > 480 min (8h).
  FOR v_row IN
    WITH day_events AS (
      SELECT
        f.nombre_empleado,
        f.fecha,
        f.timestamp,
        f.timestamp_corregido,
        f.tipo_evento,
        COALESCE(f.timestamp_corregido, f.timestamp) AS effective_ts
      FROM fichajes f
      WHERE f.fecha = v_today
        AND f.tipo_evento IN ('entrada', 'salida')
    ),
    summaries AS (
      SELECT
        nombre_empleado,
        fecha,
        MIN(CASE WHEN tipo_evento = 'entrada' THEN effective_ts END) AS primera_entrada,
        MAX(CASE WHEN tipo_evento = 'salida' THEN effective_ts END) AS ultima_salida
      FROM day_events
      GROUP BY nombre_empleado, fecha
    ),
    durations AS (
      SELECT
        s.nombre_empleado,
        s.fecha,
        s.primera_entrada,
        s.ultima_salida,
        EXTRACT(EPOCH FROM (s.ultima_salida - s.primera_entrada)) / 60 AS duracion_min
      FROM summaries s
      WHERE s.primera_entrada IS NOT NULL
        AND s.ultima_salida IS NOT NULL
    )
    SELECT
      d.nombre_empleado,
      d.fecha,
      d.primera_entrada,
      d.ultima_salida,
      d.duracion_min,
      CASE
        WHEN d.duracion_min > 480 THEN 'exceso'
        WHEN d.duracion_min < 360 THEN 'deficit'
      END AS tipo_incidencia
    FROM durations d
    WHERE d.duracion_min > 480 OR d.duracion_min < 360
    ORDER BY d.nombre_empleado
  LOOP
    v_count := COALESCE(v_count, 0) + 1;
    v_rows := v_rows || format(
      '<tr><td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;">%s</td>
       <td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;">%s</td>
       <td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;color:#16A34A;">%s</td>
       <td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;color:#DC2626;">%s</td>
       <td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;font-weight:bold;color:%s;">%s</td>
       <td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;font-weight:bold;color:%s;">%s</td></tr>',
      v_row.nombre_empleado,
      to_char(v_row.fecha, 'DD/MM/YYYY'),
      to_char(v_row.primera_entrada AT TIME ZONE 'Atlantic/Canary', 'HH24:MI'),
      to_char(v_row.ultima_salida AT TIME ZONE 'Atlantic/Canary', 'HH24:MI'),
      CASE WHEN v_row.tipo_incidencia = 'exceso' THEN '#DC2626' ELSE '#D97706' END,
      lpad(trunc(v_row.duracion_min / 60)::text, 1, '0') || 'h ' || lpad((v_row.duracion_min % 60)::text, 2, '0') || 'm',
      CASE WHEN v_row.tipo_incidencia = 'exceso' THEN '#DC2626' ELSE '#D97706' END,
      CASE WHEN v_row.tipo_incidencia = 'exceso' THEN 'Exceso (>8h)' ELSE 'Déficit (<6h)' END
    );
  END LOOP;

  v_count := COALESCE(v_count, 0);

  -- Build HTML email
  v_subject := 'Informe Diario de Incidencias - ' || to_char(v_today, 'DD/MM/YYYY');

  IF v_count = 0 THEN
    v_html := '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">'
      || '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 0;"><tr><td align="center">'
      || '<table width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">'
      || '<tr><td style="background:linear-gradient(135deg,#0C4A6E,#0369A1);padding:32px 40px;text-align:center;">'
      || '<p style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;">Informe de Incidencias</p>'
      || '<p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">' || to_char(v_today, 'DD/MM/YYYY') || '</p>'
      || '</td></tr><tr><td style="padding:36px 40px;text-align:center;">'
      || '<p style="margin:0;font-size:15px;color:#16A34A;font-weight:600;">No hay incidencias hoy</p>'
      || '<p style="margin:8px 0 0;font-size:14px;color:#475569;">Todos los empleados ficharon entre 6 y 8 horas.</p>'
      || '</td></tr></table></td></tr></table></body></html>';
  ELSE
    v_html := '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">'
      || '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 0;"><tr><td align="center">'
      || '<table width="620" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">'
      || '<tr><td style="background:linear-gradient(135deg,#0C4A6E,#0369A1);padding:32px 40px;text-align:center;">'
      || '<p style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;">Informe de Incidencias de Fichaje</p>'
      || '<p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">' || to_char(v_today, 'DD/MM/YYYY') || '</p>'
      || '</td></tr><tr><td style="padding:28px 32px;">'
      || '<p style="margin:0 0 16px;font-size:14px;color:#475569;">Se han detectado <strong style="color:#DC2626;">' || v_count || '</strong> incidencia(s) en los fichajes de hoy:</p>'
      || '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">'
      || '<thead><tr>'
      || '<th style="background:#0F172A;color:#fff;padding:8px;text-align:left;font-size:11px;">Empleado</th>'
      || '<th style="background:#0F172A;color:#fff;padding:8px;text-align:left;font-size:11px;">Fecha</th>'
      || '<th style="background:#0F172A;color:#fff;padding:8px;text-align:left;font-size:11px;">Entrada</th>'
      || '<th style="background:#0F172A;color:#fff;padding:8px;text-align:left;font-size:11px;">Salida</th>'
      || '<th style="background:#0F172A;color:#fff;padding:8px;text-align:left;font-size:11px;">Horas</th>'
      || '<th style="background:#0F172A;color:#fff;padding:8px;text-align:left;font-size:11px;">Tipo</th>'
      || '</tr></thead><tbody>'
      || v_rows
      || '</tbody></table>'
      || '<p style="margin:20px 0 0;font-size:12px;color:#94A3B8;">Este informe se genera automáticamente cada noche a las 22:00.</p>'
      || '</td></tr></table></td></tr></table></body></html>';
  END IF;

  -- ── Send via pg_net → send-email edge function ──────────────────────────────
  -- We call the edge function with the service role key (bypasses the
  -- caller auth check since we pass a valid admin-level JWT substitute).
  -- The edge function checks callerProfile role, so we use service key
  -- which gives admin access.
  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key,
      'apikey', v_service_key
    ),
    body := jsonb_build_object(
      'plantilla_id', v_plantilla_id::text,
      'cuenta_id', v_cuenta_id::text,
      'to_email', v_recipient,
      'variables', jsonb_build_object(
        'fecha', to_char(v_today, 'DD/MM/YYYY')
      ),
      'html_override', v_html,
      'subject_override', v_subject
    )
  ) INTO v_request_id;

  success := true;
  total_incidencias := v_count;
  error_msg := NULL;
  RETURN NEXT;
END;
$$;

-- ── 4. Seed default settings ──────────────────────────────────────────────────
INSERT INTO ui_settings (key, value)
VALUES ('incidence_report_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ui_settings (key, value)
SELECT 'incidence_report_email', up.email
FROM user_profiles up
WHERE up.role = 'admin'
ORDER BY up.created_at
LIMIT 1
ON CONFLICT (key) DO NOTHING;

-- ── 5. Schedule the cron job ──────────────────────────────────────────────────
-- Run every night at 22:00 (server/UTC time)
SELECT cron.schedule(
  'daily-incidence-report',
  '0 22 * * *',
  $$SELECT public.send_daily_incidence_report();$$
);
