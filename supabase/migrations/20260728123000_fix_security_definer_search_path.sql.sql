-- Fix security warnings: add explicit search_path to all SECURITY DEFINER functions
-- This prevents schema hijacking attacks without changing function behavior

ALTER FUNCTION public.bulk_create_auth_user_simple(text, text, text) SET search_path = public;
ALTER FUNCTION public.check_user_password(text, text) SET search_path = public;
ALTER FUNCTION public.create_vehicle_incident(uuid, text, uuid, text, text, text) SET search_path = public;
ALTER FUNCTION public.get_prl_document_trazabilidad(uuid) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.is_admin_or_rrhh() SET search_path = public;
ALTER FUNCTION public.sync_dni_to_empleados() SET search_path = public;
ALTER FUNCTION public.sync_empleado_dni_to_profile() SET search_path = public;
ALTER FUNCTION public.validate_vehicle_pin(text) SET search_path = public;
