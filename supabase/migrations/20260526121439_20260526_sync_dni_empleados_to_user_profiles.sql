/*
  # Sync DNI from empleados to user_profiles automatically

  When an empleado's DNI is set or updated, mirror it to the linked user_profiles row.
  This ensures the nominas RLS policy (which filters by user_profiles.dni) always works.
*/

CREATE OR REPLACE FUNCTION sync_empleado_dni_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.dni IS NOT NULL THEN
    UPDATE user_profiles
    SET dni = NEW.dni
    WHERE id = NEW.user_id
      AND (dni IS NULL OR dni != NEW.dni);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_empleado_dni ON empleados;

CREATE TRIGGER trg_sync_empleado_dni
AFTER INSERT OR UPDATE OF dni, user_id ON empleados
FOR EACH ROW
EXECUTE FUNCTION sync_empleado_dni_to_profile();
