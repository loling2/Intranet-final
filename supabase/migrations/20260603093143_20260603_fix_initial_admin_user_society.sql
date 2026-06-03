/*
  # Fix Initial Admin User - Use Valid Society

  Updates the admin user to use a valid society ID and creates empleado.
*/

DO $$
DECLARE
  v_user_id uuid;
  v_society_id uuid;
  v_count int;
BEGIN
  -- Get a valid society
  SELECT id INTO v_society_id FROM sociedades LIMIT 1;
  
  IF v_society_id IS NOT NULL THEN
    -- Get the user ID
    SELECT id INTO v_user_id FROM auth.users 
    WHERE email = 'informatica@apedeca.es' LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
      -- Update user_profile with valid society
      UPDATE user_profiles 
      SET societies = ARRAY[v_society_id::text]
      WHERE id = v_user_id;
      
      RAISE NOTICE 'User updated with valid society: %', v_society_id;
      
      -- Check if empleado exists
      SELECT COUNT(*) INTO v_count FROM empleados WHERE user_id = v_user_id;
      
      IF v_count = 0 THEN
        -- Manually create empleado since trigger might not have fired
        INSERT INTO empleados (
          user_id,
          id_sociedad,
          nombre,
          email,
          activo
        )
        VALUES (
          v_user_id,
          v_society_id,
          'Informatica Admin',
          'informatica@apedeca.es',
          TRUE
        );
        
        RAISE NOTICE 'Empleado created for user';
      END IF;
    END IF;
  END IF;
END $$;
