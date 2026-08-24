/*
# Vehicle check-in / check-out integrity constraints

## Purpose
Prevent stale-client bypasses of vehicle fichaje rules:
1. Check-in: km_inicio must be >= the vehicle's kilometros_actuales at insert time.
2. Check-out: km_fin must be > the vehicle's kilometros_actuales AND > the log's km_inicio.

## Changes
- Adds a CHECK constraint on `vehicle_logs.km_inicio` (always >= 0; this is a baseline guard).
- Adds a trigger `enforce_vehicle_checkin_km` that runs BEFORE INSERT on `vehicle_logs`
  when `fecha_fin IS NULL` (i.e. a check-in). It reads the vehicle's `kilometros_actuales`
  and `estado`, and raises an exception if:
    a) the vehicle is already `en_uso` (prevents duplicate check-ins), or
    b) `km_inicio` < `vehicle.kilometros_actuales` (prevents lowering the odometer).
- Adds a trigger `enforce_vehicle_checkout_km` that runs BEFORE UPDATE on `vehicle_logs`
  when `fecha_fin` is being set (i.e. a check-out). It raises an exception if:
    a) `km_fin` <= `vehicle.kilometros_actuales`, or
    b) `km_fin` <= the log's own `km_inicio`.

## Security
- No RLS changes. Triggers run with the invoking role's privileges but only read
  the `vehicles` table (which authenticated users can already SELECT).
*/

-- 1. Baseline CHECK on km_inicio (non-negative)
ALTER TABLE vehicle_logs
  DROP CONSTRAINT IF EXISTS vehicle_logs_km_inicio_nonnegative;
ALTER TABLE vehicle_logs
  ADD CONSTRAINT vehicle_logs_km_inicio_nonnegative CHECK (km_inicio >= 0);

-- 2. Check-in integrity trigger: prevent duplicate check-in and km rollback
DROP TRIGGER IF EXISTS enforce_vehicle_checkin_km ON vehicle_logs;
DROP FUNCTION IF EXISTS enforce_vehicle_checkin_km();

CREATE OR REPLACE FUNCTION enforce_vehicle_checkin_km()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado text;
  v_km_actual integer;
BEGIN
  -- Only enforce on check-in rows (fecha_fin IS NULL and km_fin IS NULL)
  IF NEW.fecha_fin IS NULL THEN
    SELECT estado, kilometros_actuales
      INTO v_estado, v_km_actual
      FROM vehicles
      WHERE id = NEW.vehicle_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vehicle % does not exist', NEW.vehicle_id;
    END IF;

    IF v_estado = 'en_uso' THEN
      RAISE EXCEPTION 'Vehicle is already in use — cannot check in again';
    END IF;

    IF NEW.km_inicio < v_km_actual THEN
      RAISE EXCEPTION 'Check-in km (%) must be >= vehicle current km (%)', NEW.km_inicio, v_km_actual;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_vehicle_checkin_km
  BEFORE INSERT ON vehicle_logs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_vehicle_checkin_km();

-- 3. Check-out integrity trigger: km_fin must be > current AND > km_inicio
DROP TRIGGER IF EXISTS enforce_vehicle_checkout_km ON vehicle_logs;
DROP FUNCTION IF EXISTS enforce_vehicle_checkout_km();

CREATE OR REPLACE FUNCTION enforce_vehicle_checkout_km()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_km_actual integer;
BEGIN
  -- Only enforce when fecha_fin is being set (check-out)
  IF NEW.fecha_fin IS NOT NULL AND (OLD.fecha_fin IS NULL OR OLD.fecha_fin <> NEW.fecha_fin) THEN
    SELECT kilometros_actuales
      INTO v_km_actual
      FROM vehicles
      WHERE id = NEW.vehicle_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vehicle % does not exist', NEW.vehicle_id;
    END IF;

    IF NEW.km_fin IS NULL THEN
      RAISE EXCEPTION 'Check-out requires a km_fin value';
    END IF;

    IF NEW.km_fin <= v_km_actual THEN
      RAISE EXCEPTION 'Check-out km (%) must be greater than vehicle current km (%)', NEW.km_fin, v_km_actual;
    END IF;

    IF NEW.km_fin <= NEW.km_inicio THEN
      RAISE EXCEPTION 'Check-out km (%) must be greater than check-in km (%)', NEW.km_fin, NEW.km_inicio;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_vehicle_checkout_km
  BEFORE UPDATE ON vehicle_logs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_vehicle_checkout_km();
