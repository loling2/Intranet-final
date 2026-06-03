/*
  # Sync user_profiles employees to empleados + auto-create trigger

  ## Problems Fixed
  1. Employees in user_profiles not appearing in empleados table (Prevención only sees 2)
  2. New employee users don't auto-get an empleados row

  ## Changes
  - Backfill: insert empleados rows for all employee user_profiles that lack one
  - Trigger: auto-create empleados row when a user_profile with role=employee is created/updated
  - Fix prevencion RLS to see all active employees
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Backfill empleados from user_profiles (role=employee, no empleados entry)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r record;
  v_society_id text;
  v_valid_society uuid;
BEGIN
  FOR r IN
    SELECT up.id, up.nombre, up.email, up.societies
    FROM user_profiles up
    WHERE up.role = 'employee'
      AND up.activo = true
      AND NOT EXISTS (SELECT 1 FROM empleados e WHERE e.user_id = up.id)
  LOOP
    -- Find first valid society ID that exists in sociedades table
    v_valid_society := NULL;

    IF r.societies IS NOT NULL THEN
      FOR v_society_id IN SELECT unnest(r.societies) LOOP
        IF EXISTS (SELECT 1 FROM sociedades WHERE id = v_society_id::uuid) THEN
          v_valid_society := v_society_id::uuid;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    -- Fallback to Apedeca (frontend ID)
    IF v_valid_society IS NULL THEN
      SELECT id INTO v_valid_society FROM sociedades WHERE nombre = 'Apedeca' LIMIT 1;
    END IF;

    INSERT INTO empleados (user_id, id_sociedad, nombre, email, activo, estado_contrato)
    VALUES (r.id, v_valid_society, r.nombre, r.email, true, 'indefinido')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Trigger function: auto-create empleados when user_profile role=employee
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_employee_from_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_society_id text;
  v_valid_society uuid;
BEGIN
  IF NEW.role <> 'employee' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM empleados WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_valid_society := NULL;
  IF NEW.societies IS NOT NULL THEN
    FOR v_society_id IN SELECT unnest(NEW.societies) LOOP
      IF EXISTS (SELECT 1 FROM sociedades WHERE id = v_society_id::uuid) THEN
        v_valid_society := v_society_id::uuid;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF v_valid_society IS NULL THEN
    SELECT id INTO v_valid_society FROM sociedades WHERE nombre = 'Apedeca' LIMIT 1;
  END IF;

  INSERT INTO empleados (user_id, id_sociedad, nombre, email, activo, estado_contrato)
  VALUES (NEW.id, v_valid_society, NEW.nombre, NEW.email, true, 'indefinido')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_profile_employee_created ON user_profiles;
CREATE TRIGGER on_user_profile_employee_created
  AFTER INSERT OR UPDATE OF role ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION sync_employee_from_profile();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Ensure prevencion can SELECT all active empleados
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'empleados' AND policyname = 'Prevencion can view all employees'
  ) THEN
    EXECUTE '
      CREATE POLICY "Prevencion can view all employees"
        ON empleados FOR SELECT
        TO authenticated
        USING (is_prevencion() OR is_admin_or_rrhh())
    ';
  END IF;
END $$;
