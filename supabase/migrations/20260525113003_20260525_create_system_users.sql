/*
  # Crear usuarios del sistema en auth.users y user_profiles

  ## Usuarios creados
  - admin@empresa.com (role: admin, password: admin1234)
  - rrhh@empresa.com  (role: rrhh,  password: rrhh1234)

  Estos usuarios son los equivalentes en Supabase Auth de los validUsers hardcodeados en mockData.ts.
  Tras esta migración, el login puede pasar a usar supabase.auth.signInWithPassword().
*/

DO $$
DECLARE
  v_admin_id uuid;
  v_rrhh_id uuid;
BEGIN
  -- ── ADMIN ─────────────────────────────────────────────
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@empresa.com';

  IF v_admin_id IS NULL THEN
    v_admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@empresa.com',
      crypt('admin1234', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"nombre":"Administrador"}',
      'authenticated', 'authenticated',
      now(), now(), '', '', '', ''
    );
  END IF;

  INSERT INTO user_profiles (id, nombre, email, role, activo, societies)
  VALUES (v_admin_id, 'Administrador', 'admin@empresa.com', 'admin', true, '{}')
  ON CONFLICT (id) DO UPDATE SET
    nombre = 'Administrador', role = 'admin', activo = true;

  -- ── RRHH ──────────────────────────────────────────────
  SELECT id INTO v_rrhh_id FROM auth.users WHERE email = 'rrhh@empresa.com';

  IF v_rrhh_id IS NULL THEN
    v_rrhh_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      v_rrhh_id,
      '00000000-0000-0000-0000-000000000000',
      'rrhh@empresa.com',
      crypt('rrhh1234', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"nombre":"Responsable RRHH"}',
      'authenticated', 'authenticated',
      now(), now(), '', '', '', ''
    );
  END IF;

  INSERT INTO user_profiles (id, nombre, email, role, activo, societies)
  VALUES (v_rrhh_id, 'Responsable RRHH', 'rrhh@empresa.com', 'rrhh', true, '{}')
  ON CONFLICT (id) DO UPDATE SET
    nombre = 'Responsable RRHH', role = 'rrhh', activo = true;

END $$;
