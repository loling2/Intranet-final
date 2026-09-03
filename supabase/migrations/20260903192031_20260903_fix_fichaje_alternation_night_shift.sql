
-- Update the alternation trigger to look at the last event within 16 hours
-- instead of only same-day events, so night shifts (entrada yesterday, salida today) work.
CREATE OR REPLACE FUNCTION public.check_fichaje_alternation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_last_tipo text;
  v_last_at timestamptz;
BEGIN
  IF NEW.tipo_evento NOT IN ('entrada', 'salida') OR NEW.es_manual THEN
    RETURN NEW;
  END IF;

  SELECT f.tipo_evento, COALESCE(f.timestamp_corregido, f.timestamp)
  INTO v_last_tipo, v_last_at
  FROM public.fichajes f
  WHERE f.tipo_evento IN ('entrada', 'salida')
  AND (
    (NEW.empleado_id IS NOT NULL AND f.empleado_id = NEW.empleado_id)
    OR (NEW.empleado_id IS NULL AND f.empleado_id IS NULL AND f.nombre_empleado = NEW.nombre_empleado)
  )
  ORDER BY COALESCE(f.timestamp_corregido, f.timestamp) DESC, f.timestamp DESC
  LIMIT 1;

  -- Only enforce alternation if the last event was within 16 hours
  IF v_last_tipo IS NOT NULL AND v_last_at > now() - interval '16 hours' THEN
    IF v_last_tipo = NEW.tipo_evento THEN
      IF NEW.tipo_evento = 'entrada' THEN
        RAISE EXCEPTION 'Ya existe una entrada activa. Debes fichar la salida antes de registrar una nueva entrada.';
      ELSE
        RAISE EXCEPTION 'No hay una entrada activa. Debes fichar la entrada antes de registrar la salida.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
