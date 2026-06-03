/*
  # Create Initial Admin User

  Creates the first admin user (informatica@apedeca.es) with password Admin1234!
  This allows initial login to the system.
*/

DO $$
DECLARE
  v_user_id uuid;
  v_hashed_pwd text;
  v_exists_count int;
BEGIN
  -- Check if user already exists
  SELECT COUNT(*) INTO v_exists_count FROM auth.users 
  WHERE email = 'informatica@apedeca.es';
  
  IF v_exists_count = 0 THEN
    -- Generate bcrypt hash for password
    v_hashed_pwd := crypt('Admin1234!', gen_salt('bf'));
    
    -- Create auth user
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      is_sso_user,
      is_anonymous,
      created_at,
      updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'informatica@apedeca.es',
      v_hashed_pwd,
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      FALSE,
      FALSE,
      FALSE,
      now(),
      now()
    )
    RETURNING id INTO v_user_id;
    
    -- Create user_profile (trigger will auto-create empleado)
    INSERT INTO user_profiles (
      id,
      nombre,
      email,
      role,
      activo,
      societies
    )
    VALUES (
      v_user_id,
      'Informatica Admin',
      'informatica@apedeca.es',
      'admin',
      TRUE,
      ARRAY['11111111-1111-1111-1111-111111111111']::text[]
    );
    
    RAISE NOTICE 'Admin user created: informatica@apedeca.es (ID: %)', v_user_id;
  ELSE
    RAISE NOTICE 'User informatica@apedeca.es already exists';
  END IF;
END $$;
