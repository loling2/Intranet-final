/*
# Add id_sociedad to get_employees_fichaje_modes RPC

1. Modified Functions
- `get_employees_fichaje_modes()` now also returns `id_sociedad` so the frontend
  can filter employees by society for scoped roles (e.g. rrhh_gerontalia).
2. Security
- No RLS changes. The function is SECURITY DEFINER and returns the same rows
  as before (active employees), just with one additional column.
*/

DROP FUNCTION IF EXISTS public.get_employees_fichaje_modes();

CREATE FUNCTION public.get_employees_fichaje_modes()
RETURNS TABLE(id uuid, nombre text, fichaje_mode text, id_sociedad text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT e.id, e.nombre, e.fichaje_mode, e.id_sociedad::text
FROM empleados e
WHERE e.activo = true
ORDER BY e.nombre;
$function$;
