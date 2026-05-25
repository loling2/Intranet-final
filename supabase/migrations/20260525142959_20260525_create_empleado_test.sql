/*
  # Crear usuario empleado de prueba

  Crea un usuario en auth.users y su perfil en user_profiles con rol 'employee'
  para poder probar el acceso de empleados (nóminas filtradas por DNI, carpetas PRL por tag, etc.)

  Credenciales:
    Email: empleado@empresa.com
    Password: empleado123
    DNI: 12345678A
*/

DO $$
DECLARE
  v_uid uuid := gen_random_uuid();
  v_encrypted_pw text;
BEGIN
  -- Generar hash bcrypt (cost 10) para la contraseña
  v_encrypted_pw := crypt('empleado123', gen_salt('bf', 10));

  -- Insertar en auth.users si no existe
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'empleado@empresa.com') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password,
      email_confirmed_at, confirmation_sent_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, is_sso_user, deleted_at
    ) VALUES (
      v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'empleado@empresa.com', v_encrypted_pw,
      now(), now(),
      now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"nombre":"Empleado Test"}',
      false, false, null
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, provider,
      identity_data, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_uid, 'empleado@empresa.com', 'email',
      jsonb_build_object('sub', v_uid::text, 'email', 'empleado@empresa.com'),
      now(), now(), now()
    );

    INSERT INTO user_profiles (id, nombre, email, role, activo, societies, dni)
    VALUES (
      v_uid,
      'Empleado Test',
      'empleado@empresa.com',
      'employee',
      true,
      '{}',
      '12345678A'
    );
  ELSE
    -- Si ya existe, actualizar password y asegurar perfil
    UPDATE auth.users
    SET encrypted_password = v_encrypted_pw, updated_at = now()
    WHERE email = 'empleado@empresa.com';

    -- Asegurar que tiene perfil
    INSERT INTO user_profiles (id, nombre, email, role, activo, societies, dni)
    SELECT u.id, 'Empleado Test', 'empleado@empresa.com', 'employee', true, '{}', '12345678A'
    FROM auth.users u
    WHERE u.email = 'empleado@empresa.com'
    ON CONFLICT (id) DO UPDATE SET role = 'employee', activo = true, dni = '12345678A';
  END IF;
END $$;
