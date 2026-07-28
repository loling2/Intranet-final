-- Helper: check if current user is a staff role (admin, rrhh, prevencion, supervisor, administracion, calidad, formacion)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM user_profiles
  WHERE id = auth.uid()
    AND role IN ('admin', 'rrhh', 'prevencion', 'supervisor', 'administracion', 'calidad', 'formacion')
);
$function$;

-- Helper: check if current user is admin or rrhh
-- (is_admin_or_rrhh already exists, but let's also create is_admin_or_supervisor for convenience)
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM user_profiles
  WHERE id = auth.uid()
    AND role IN ('admin', 'rrhh', 'supervisor')
);
$function$;
