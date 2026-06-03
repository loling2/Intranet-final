/*
  # Sync DNI from user_profiles to empleados

  Many employees have dni = null in the empleados table but the correct
  DNI exists in user_profiles.dni (linked via empleados.user_id = user_profiles.id).
  This migration backfills empleados.dni from user_profiles.dni where missing,
  and adds a trigger to keep them in sync going forward.
*/

-- Backfill: copy dni from user_profiles into empleados where dni is null
UPDATE empleados e
SET dni = up.dni
FROM user_profiles up
WHERE e.user_id = up.id
  AND e.dni IS NULL
  AND up.dni IS NOT NULL;

-- Trigger to keep them in sync when user_profiles.dni changes
CREATE OR REPLACE FUNCTION sync_dni_to_empleados()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.dni IS DISTINCT FROM OLD.dni THEN
    UPDATE empleados
    SET dni = NEW.dni
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_dni_to_empleados ON user_profiles;
CREATE TRIGGER trg_sync_dni_to_empleados
  AFTER UPDATE OF dni ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_dni_to_empleados();
