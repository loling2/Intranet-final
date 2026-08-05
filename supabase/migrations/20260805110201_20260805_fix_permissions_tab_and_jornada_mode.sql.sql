-- 1. SECURITY DEFINER function to list all active employees with fichaje_mode
--    Bypasses RLS so admin/rrhh can manage permissions for all employees
CREATE OR REPLACE FUNCTION public.get_employees_fichaje_modes()
RETURNS TABLE(
  id uuid,
  nombre text,
  fichaje_mode text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT e.id, e.nombre, e.fichaje_mode
FROM empleados e
WHERE e.activo = true
ORDER BY e.nombre;
$function$;

GRANT EXECUTE ON FUNCTION public.get_employees_fichaje_modes() TO authenticated;

-- 2. Modify validate_vehicle_pin to also return fichaje_mode
DROP FUNCTION IF EXISTS public.validate_vehicle_pin(text);

CREATE FUNCTION public.validate_vehicle_pin(p_pin text)
RETURNS TABLE(
  id uuid,
  nombre text,
  empleado_id uuid,
  fichaje_mode text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT up.id, up.nombre, e.id AS empleado_id, COALESCE(e.fichaje_mode, 'kiosk_only') AS fichaje_mode
FROM user_profiles up
LEFT JOIN empleados e ON e.user_id = up.id
WHERE up.pin = p_pin
AND up.activo = true
LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.validate_vehicle_pin(text) TO anon, authenticated;
