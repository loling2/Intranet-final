CREATE OR REPLACE FUNCTION public.reset_reconocimiento_medico_anual()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE empleados
  SET reconocimiento_medico = 'pendiente'
  WHERE reconocimiento_medico IS DISTINCT FROM 'pendiente';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_reconocimiento_medico_anual() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('reset-reconocimiento-medico-anual')
  FROM cron.job WHERE jobname = 'reset-reconocimiento-medico-anual';
END $$;

-- 23:00 UTC del 31 de diciembre = 00:00 del 1 de enero en Madrid (CET)
SELECT cron.schedule(
  'reset-reconocimiento-medico-anual',
  '0 23 31 12 *',
  $$SELECT public.reset_reconocimiento_medico_anual()$$
);
