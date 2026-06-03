/*
  # Fix: Sync Trigger Robustness & Error Handling

  Improves the sync_auth_user_to_empleado trigger to:
  1. Better error handling and logging
  2. Explicit NULL checks before FK insert
  3. Prevents trigger from breaking login flow
  4. Allows login to complete even if empleado creation fails
*/

-- Drop and recreate the trigger function with better error handling
CREATE OR REPLACE FUNCTION sync_auth_user_to_empleado()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_default_society uuid;
  v_empleado_exists boolean;
  v_first_society_text text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Check if empleado already exists
    SELECT EXISTS(SELECT 1 FROM empleados WHERE user_id = NEW.id)
    INTO v_empleado_exists;
    
    IF NOT v_empleado_exists THEN
      v_default_society := NULL;
      
      -- Try to get society from user's assigned societies
      IF NEW.societies IS NOT NULL AND array_length(NEW.societies, 1) > 0 THEN
        v_first_society_text := NEW.societies[1];
        BEGIN
          v_default_society := v_first_society_text::uuid;
        EXCEPTION WHEN OTHERS THEN
          v_default_society := NULL;
        END;
      END IF;
      
      -- If no valid society, get first available
      IF v_default_society IS NULL THEN
        BEGIN
          SELECT id INTO v_default_society FROM sociedades ORDER BY created_at ASC LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
          v_default_society := NULL;
        END;
      END IF;
      
      -- Only insert if we have a valid society (to prevent FK violation)
      IF v_default_society IS NOT NULL THEN
        BEGIN
          INSERT INTO empleados (
            user_id,
            id_sociedad,
            nombre,
            email,
            activo
          ) VALUES (
            NEW.id,
            v_default_society,
            COALESCE(NEW.nombre, ''),
            COALESCE(NEW.email, ''),
            COALESCE(NEW.activo, true)
          );
        EXCEPTION WHEN OTHERS THEN
          -- Log error but don't break trigger - user login shouldn't fail
          RAISE WARNING 'sync_auth_user_to_empleado: Failed to create empleado for user %: %', NEW.id, SQLERRM;
        END;
      ELSE
        -- No valid society found - log but don't break
        RAISE WARNING 'sync_auth_user_to_empleado: No valid society found for user %', NEW.id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Ensure trigger is properly set
DROP TRIGGER IF EXISTS trg_sync_auth_user_to_empleado ON user_profiles;

CREATE TRIGGER trg_sync_auth_user_to_empleado
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_auth_user_to_empleado();

-- Test: Verify trigger works
DO $$
DECLARE
  v_test_user_id uuid;
  v_empleado_count int;
BEGIN
  -- Insert test user_profile
  INSERT INTO user_profiles (id, nombre, email, role, activo, societies)
  VALUES (gen_random_uuid(), 'Trigger Test', 'trigger_test@test.com', 'employee', true, ARRAY['11111111-1111-1111-1111-111111111111'])
  RETURNING id INTO v_test_user_id;
  
  -- Check if empleado was created
  SELECT COUNT(*) INTO v_empleado_count FROM empleados WHERE user_id = v_test_user_id;
  
  IF v_empleado_count = 1 THEN
    RAISE NOTICE 'Trigger test PASSED: Empleado created for user %', v_test_user_id;
    -- Clean up test data
    DELETE FROM empleados WHERE user_id = v_test_user_id;
    DELETE FROM user_profiles WHERE id = v_test_user_id;
  ELSE
    RAISE NOTICE 'Trigger test FAILED: Expected 1 empleado, found %', v_empleado_count;
    DELETE FROM user_profiles WHERE id = v_test_user_id;
  END IF;
END $$;
