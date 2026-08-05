/*
# Update validate_vehicle_pin to return empleado_id + add kiosk_check_device_by_profile

1. Changes to `validate_vehicle_pin`
   - DROP and recreate to change return type: now also returns `empleado_id` (uuid).
   - The frontend PIN flow can then pass it to kiosk_check_device.

2. New `kiosk_check_device_by_profile`
   - Accepts p_user_profile_id (uuid) and p_device_key (text).
   - Returns json { authorized, mode }.
   - Joins user_profiles → empleados to check fichaje_mode.
*/

DROP FUNCTION IF EXISTS public.validate_vehicle_pin(text);

CREATE FUNCTION public.validate_vehicle_pin(p_pin text)
RETURNS TABLE(id uuid, nombre text, empleado_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id, up.nombre, e.id AS empleado_id
  FROM user_profiles up
  LEFT JOIN empleados e ON e.user_id = up.id
  WHERE up.pin = p_pin
    AND up.activo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.kiosk_check_device_by_profile(p_device_key text, p_user_profile_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'authorized',
    CASE
      WHEN e.fichaje_mode = 'free' THEN true
      WHEN e.fichaje_mode = 'kiosk_and_phone' THEN
        EXISTS(SELECT 1 FROM kiosk_devices kd WHERE kd.device_key = p_device_key AND kd.is_active)
        OR EXISTS(SELECT 1 FROM employee_registered_devices erd WHERE erd.device_key = p_device_key AND erd.empleado_id = e.id AND erd.is_active)
      ELSE
        EXISTS(SELECT 1 FROM kiosk_devices kd WHERE kd.device_key = p_device_key AND kd.is_active)
    END,
    'mode', COALESCE(e.fichaje_mode, 'kiosk_only')
  )
  FROM user_profiles up
  LEFT JOIN empleados e ON e.user_id = up.id
  WHERE up.id = p_user_profile_id
  LIMIT 1;
$$;
