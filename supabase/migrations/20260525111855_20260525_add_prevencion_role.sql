/*
  # Añadir rol 'prevencion' y crear usuario Gestor Prevencion

  ## Cambios
  1. Inserta el rol 'prevencion' en app_roles (si no existe)
  2. Crea el perfil del usuario prevencion@empresa.com en user_profiles
  3. Crea el registro de empleado vinculado a Serca Gestion
  4. Asigna el tag 'Prevencion' al empleado para que tenga acceso a documentos con ese tag

  ## Nota sobre Auth
  El usuario en auth.users debe crearse via Supabase Auth API (signUp).
  Aqui creamos el perfil en user_profiles usando un UUID fijo que se
  actualizara cuando el usuario haga su primer login.
*/

-- 1. Añadir rol prevencion
INSERT INTO app_roles (name, description)
VALUES ('prevencion', 'Acceso al modulo de prevencion y calidad. Lectura de documentos con tag Prevencion.')
ON CONFLICT (name) DO NOTHING;

-- 2. Crear perfil en user_profiles con UUID temporal
-- (Se vinculara al auth.uid() real cuando el usuario haga login por primera vez)
DO $$
DECLARE
  v_sociedad_id uuid;
  v_empleado_id uuid;
  v_tag_id uuid;
  v_profile_id uuid := gen_random_uuid();
BEGIN
  -- Obtener id de Serca Gestion
  SELECT id INTO v_sociedad_id FROM sociedades WHERE nombre = 'Serca Gestion' LIMIT 1;

  IF v_sociedad_id IS NULL THEN
    RAISE EXCEPTION 'No se encontro la sociedad Serca Gestion';
  END IF;

  -- Crear perfil en user_profiles (sin id de auth, se actualizara tras primer login)
  INSERT INTO user_profiles (id, nombre, email, role, activo, societies)
  VALUES (
    v_profile_id,
    'Gestor Prevencion',
    'prevencion@empresa.com',
    'prevencion',
    true,
    ARRAY[v_sociedad_id::text]
  )
  ON CONFLICT DO NOTHING;

  -- Crear empleado vinculado
  INSERT INTO empleados (id, user_id, id_sociedad, nombre, email, puesto, activo)
  VALUES (
    gen_random_uuid(),
    v_profile_id,
    v_sociedad_id,
    'Gestor Prevencion',
    'prevencion@empresa.com',
    'Prevencionista',
    true
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_empleado_id;

  -- Si se creo el empleado, asignar tag Prevencion
  IF v_empleado_id IS NOT NULL THEN
    SELECT id INTO v_tag_id FROM tags WHERE nombre = 'Prevencion' LIMIT 1;
    IF v_tag_id IS NOT NULL THEN
      INSERT INTO etiquetado (entidad_id, tag_id)
      VALUES (v_empleado_id, v_tag_id)
      ON CONFLICT (entidad_id, tag_id) DO NOTHING;
    END IF;
  END IF;
END $$;
