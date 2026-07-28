/*
# Sync empleado activo status to user_profiles

## Purpose
When an employee is marked as inactive (activo = false) in the
`empleados` table, the linked `user_profiles.activo` flag must also
be set to false. This blocks both web login (admin-login edge function
checks profile.activo) and PIN-based kiosk access (validate_vehicle_pin
checks user_profiles.activo = true).

## Changes
1. Creates a trigger function `sync_empleado_activo_to_user_profile()`
   that updates `user_profiles.activo` to match `empleados.activo`
   whenever the empleados row is inserted or updated.
2. Attaches the trigger to the `empleados` table.
3. Backfills existing rows: sets user_profiles.activo = false for any
   user_profile linked to an empleado with activo = false.

## Security
- The trigger function is SECURITY DEFINER so it can update
  user_profiles regardless of the calling user's RLS.
- Only the `activo` column of user_profiles is touched.
*/

CREATE OR REPLACE FUNCTION public.sync_empleado_activo_to_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only sync if there is a linked user_id
  IF NEW.user_id IS NOT NULL THEN
    UPDATE user_profiles
      SET activo = NEW.activo, updated_at = now()
      WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_empleado_activo ON empleados;

CREATE TRIGGER trg_sync_empleado_activo
  AFTER INSERT OR UPDATE OF activo, user_id ON empleados
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_empleado_activo_to_user_profile();

-- Backfill: deactivate user_profiles linked to inactive empleados
UPDATE user_profiles up
  SET activo = false, updated_at = now()
  FROM empleados e
  WHERE e.user_id = up.id
    AND e.activo = false
    AND up.activo = true;
