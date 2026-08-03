/*
# Fix daily incidence report to call dedicated edge function

## Purpose
The original `send_daily_incidence_report()` SQL function tried to call
the `send-email` edge function, which requires a user JWT for auth —
something the cron job cannot provide. We now have a dedicated
`incidence-report` edge function that authenticates with the service
role key (available as a Deno env var) and handles the full flow:
compute incidencias → build HTML → send via SMTP.

## Changes
- Drops and recreates `send_daily_incidence_report()` as a simpler
  wrapper that calls the `incidence-report` edge function via `pg_net`.
- The edge function reads `incidence_report_enabled` and
  `incidence_report_email` from `ui_settings` directly.
- Reschedules the cron job to call the new function.
- No schema or RLS changes.
*/

DROP FUNCTION IF EXISTS public.send_daily_incidence_report();

CREATE OR REPLACE FUNCTION public.send_daily_incidence_report()
RETURNS TABLE (success boolean, error_msg text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_supabase_url text;
  v_service_key text;
  v_request_id bigint;
BEGIN
  -- Try to get the Supabase URL from various GUC locations
  BEGIN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
  END;

  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    BEGIN
      v_supabase_url := current_setting('app.supabase_url', true);
    EXCEPTION WHEN OTHERS THEN
      v_supabase_url := NULL;
    END;
  END IF;

  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    success := false;
    error_msg := 'Could not determine Supabase URL';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Get service role key
  BEGIN
    v_service_key := current_setting('app.settings.supabase_service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;

  IF v_service_key IS NULL OR v_service_key = '' THEN
    success := false;
    error_msg := 'Could not determine service role key';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Call the incidence-report edge function via pg_net
  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/incidence-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key,
      'apikey', v_service_key
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  success := true;
  error_msg := NULL;
  RETURN NEXT;
END;
$$;

-- Reschedule the cron job (drop old, create new)
SELECT cron.unschedule('daily-incidence-report');
SELECT cron.schedule(
  'daily-incidence-report',
  '0 22 * * *',
  $$SELECT public.send_daily_incidence_report();$$
);
