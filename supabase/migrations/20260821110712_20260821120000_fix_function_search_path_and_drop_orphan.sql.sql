-- 1. Fix mutable search_path on trigger helper functions (non-breaking, security hardening)
-- These functions are used by triggers; adding SET search_path TO 'public' prevents search_path hijacking.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_empleados_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_dispositivos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prl_cron_expr(p_hour integer, p_frequency text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
SELECT CASE
  WHEN p_frequency = 'weekly'  THEN format('%s 8 * * 1', lpad(p_hour::text, 2, '0'))
  WHEN p_frequency = 'every3' THEN format('%s 8 */3 * *', lpad(p_hour::text, 2, '0'))
  ELSE format('%s 8 * * *', lpad(p_hour::text, 2, '0'))
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_folder_tag_limit_fn()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF (SELECT count(*) FROM prl_folder_tags WHERE folder_id = NEW.folder_id) >= 15 THEN
    RAISE EXCEPTION 'A folder can have at most 15 tags';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_employee_pin(p_pin text)
RETURNS TABLE(id uuid, nombre text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT id, nombre FROM empleados WHERE pin = p_pin AND activo = true;
$function$;

CREATE OR REPLACE FUNCTION public.register_fichaje(p_empleado_id uuid, p_tipo text, p_lat numeric DEFAULT NULL::numeric, p_lng numeric DEFAULT NULL::numeric)
RETURNS TABLE(ok boolean, message text, tipo text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_tipo NOT IN ('entrada', 'salida') THEN
    RETURN QUERY SELECT false, 'Tipo no válido'::text, p_tipo;
    RETURN;
  END IF;

  INSERT INTO fichajes (empleado_id, nombre_empleado, fecha, timestamp, tipo_evento, metodo, latitud, longitud)
  SELECT p_empleado_id, nombre, CURRENT_DATE, now(), p_tipo, 'kiosk', p_lat, p_lng
  FROM empleados WHERE id = p_empleado_id;

  RETURN QUERY SELECT true,
    (p_tipo || ' registrada a las ' || to_char(now(), 'HH24:MI'))::text,
    p_tipo;
END;
$function$;

-- 2. Drop orphaned function: check_folder_tag_limit was replaced by enforce_folder_tag_limit_fn
-- No trigger references it anymore.
DROP FUNCTION IF EXISTS public.check_folder_tag_limit();
