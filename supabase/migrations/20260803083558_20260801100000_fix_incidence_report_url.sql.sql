/*
# Store Supabase URL in ui_settings and fix cron function

## Purpose
The SQL cron function needs the project URL to call the incidence-report
edge function via pg_net. The URL is not available as a GUC, so we store
it in ui_settings. The service role key is NOT stored in the database —
the edge function reads it from its own Deno env vars.

## Changes
- Seeds `supabase_url` into ui_settings.
- Replaces `send_daily_incidence_report()` to read the URL from
  ui_settings and call the edge function with the anon key (the edge
  function has verify_jwt=false and uses the service key internally).
- No schema or RLS changes.
*/

INSERT INTO ui_settings (key, value)
VALUES ('supabase_url', 'https://efdlxhkbrqtsezzwrmtu.supabase.co')
ON CONFLICT (key) DO NOTHING;

DROP FUNCTION IF EXISTS public.send_daily_incidence_report();

CREATE OR REPLACE FUNCTION public.send_daily_incidence_report()
RETURNS TABLE (success boolean, error_msg text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_supabase_url text;
  v_anon_key text;
  v_request_id bigint;
BEGIN
  SELECT value INTO v_supabase_url FROM ui_settings WHERE key = 'supabase_url' LIMIT 1;
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    success := false;
    error_msg := 'supabase_url not configured in ui_settings';
    RETURN NEXT;
    RETURN;
  END IF;

  -- The edge function has verify_jwt=false, so the anon key is sufficient
  -- for the HTTP call. The edge function uses the service role key
  -- internally (from Deno env) to read the database.
  BEGIN
    v_anon_key := current_setting('app.settings.supabase_anon_key', true);
  EXCEPTION WHEN OTHERS THEN
    v_anon_key := NULL;
  END;

  -- If no anon key available, call without auth header (verify_jwt=false)
  IF v_anon_key IS NOT NULL AND v_anon_key <> '' THEN
    SELECT net.http_post(
      url := v_supabase_url || '/functions/v1/incidence-report',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'apikey', v_anon_key
      ),
      body := '{}'::jsonb
    ) INTO v_request_id;
  ELSE
    SELECT net.http_post(
      url := v_supabase_url || '/functions/v1/incidence-report',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := '{}'::jsonb
    ) INTO v_request_id;
  END IF;

  success := true;
  error_msg := NULL;
  RETURN NEXT;
END;
$$;

-- Reschedule
SELECT cron.unschedule('daily-incidence-report');
SELECT cron.schedule(
  'daily-incidence-report',
  '0 22 * * *',
  $$SELECT public.send_daily_incidence_report();$$
);
