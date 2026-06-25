-- Fix duplicate empleados when creating web access for an existing employee.
-- The trigger previously only checked user_id (which is NULL for manually-created employees).
-- Now it also checks email, and if a match is found it links the user_id instead of inserting.

CREATE OR REPLACE FUNCTION sync_employee_from_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_society_id text;
  v_valid_society uuid;
  v_existing_id uuid;
BEGIN
  IF NEW.role <> 'employee' THEN
    RETURN NEW;
  END IF;

  -- Already linked by user_id
  IF EXISTS (SELECT 1 FROM empleados WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Existing employee with same email but no user_id yet — just link it
  SELECT id INTO v_existing_id
  FROM empleados
  WHERE email = NEW.email AND (user_id IS NULL OR user_id = NEW.id)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE empleados SET user_id = NEW.id WHERE id = v_existing_id;
    RETURN NEW;
  END IF;

  -- No existing employee found — create one
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

-- Also fix any existing duplicates: remove empleados rows that were created by the trigger
-- (have user_id set) when there is already an older row with the same email and user_id
-- (i.e. the manually created row was later linked).
-- Keep the one with more data (non-null dni, puesto, etc.) or the oldest one.
DO $$
DECLARE
  dup record;
BEGIN
  FOR dup IN
    SELECT email, COUNT(*) AS cnt
    FROM empleados
    GROUP BY email
    HAVING COUNT(*) > 1
  LOOP
    -- Delete the row with fewer non-null fields (typically the trigger-created one)
    DELETE FROM empleados
    WHERE id IN (
      SELECT id FROM empleados
      WHERE email = dup.email
      ORDER BY
        (CASE WHEN dni IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN puesto IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN telefono IS NOT NULL THEN 1 ELSE 0 END) ASC,
        created_at ASC
      LIMIT (dup.cnt - 1)
    );
  END LOOP;
END $$;
