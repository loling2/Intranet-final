/*
  # Crear usuario prevencion@empresa.com en auth.users

  Inserta el usuario directamente en auth.users con password hasheada
  y luego sincroniza el UUID con el perfil ya creado en user_profiles.

  Contrasena temporal: Prevencion2026!
*/

DO $$
DECLARE
  v_auth_id uuid;
  v_profile_id uuid;
  v_sociedad_id uuid;
  v_empleado_id uuid;
  v_tag_id uuid;
BEGIN
  -- Verificar si ya existe en auth
  SELECT id INTO v_auth_id FROM auth.users WHERE email = 'prevencion@empresa.com';

  IF v_auth_id IS NULL THEN
    v_auth_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      v_auth_id,
      '00000000-0000-0000-0000-000000000000',
      'prevencion@empresa.com',
      crypt('Prevencion2026!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"nombre":"Gestor Prevencion"}',
      'authenticated',
      'authenticated',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  END IF;

  -- Obtener id de Serca Gestion
  SELECT id INTO v_sociedad_id FROM sociedades WHERE nombre = 'Serca Gestion' LIMIT 1;

  -- Actualizar/crear perfil con el UUID real de auth
  INSERT INTO user_profiles (id, nombre, email, role, activo, societies)
  VALUES (
    v_auth_id,
    'Gestor Prevencion',
    'prevencion@empresa.com',
    'prevencion',
    true,
    ARRAY[v_sociedad_id::text]
  )
  ON CONFLICT (id) DO UPDATE SET
    nombre = 'Gestor Prevencion',
    email = 'prevencion@empresa.com',
    role = 'prevencion',
    activo = true,
    societies = ARRAY[v_sociedad_id::text];

  -- Limpiar perfil temporal sin auth si existe
  DELETE FROM user_profiles
  WHERE email = 'prevencion@empresa.com'
    AND id <> v_auth_id;

  -- Crear o actualizar empleado con el UUID correcto
  SELECT id INTO v_empleado_id FROM empleados WHERE email = 'prevencion@empresa.com' LIMIT 1;

  IF v_empleado_id IS NULL THEN
    INSERT INTO empleados (id, user_id, id_sociedad, nombre, email, puesto, activo)
    VALUES (
      gen_random_uuid(),
      v_auth_id,
      v_sociedad_id,
      'Gestor Prevencion',
      'prevencion@empresa.com',
      'Prevencionista',
      true
    )
    RETURNING id INTO v_empleado_id;
  ELSE
    UPDATE empleados SET user_id = v_auth_id WHERE id = v_empleado_id;
  END IF;

  -- Asignar tag Prevencion al empleado
  SELECT id INTO v_tag_id FROM tags WHERE nombre = 'Prevencion' LIMIT 1;
  IF v_tag_id IS NOT NULL AND v_empleado_id IS NOT NULL THEN
    INSERT INTO etiquetado (entidad_id, tag_id)
    VALUES (v_empleado_id, v_tag_id)
    ON CONFLICT (entidad_id, tag_id) DO NOTHING;
  END IF;

END $$;
