CREATE OR REPLACE FUNCTION public.crm_es_gestor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM public.user_profiles
  WHERE id = auth.uid()
  AND (
    role IN ('admin', 'rrhh', 'supervisor', 'coordinador')
    OR roles && ARRAY['admin', 'rrhh', 'supervisor', 'coordinador']::text[]
  )
);
$function$;