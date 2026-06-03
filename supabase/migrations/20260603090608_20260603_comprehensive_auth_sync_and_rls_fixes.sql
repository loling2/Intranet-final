/*
  # Comprehensive Auth-Empleados Sync & RLS Remediation

  ## CRITICAL FIXES
  
  1. Automatic employee record creation on user registration
  2. Cascading delete from user_profiles to empleados  
  3. Society-aware RLS filtering for employees
  4. Helper functions for role checking
*/

-- ─────────────────────────────────────────────────────────────────────
-- Helper Functions
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_rrhh()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'rrhh'
      AND user_profiles.activo = true
  );
$$;

CREATE OR REPLACE FUNCTION is_employee_activo()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'employee'
      AND user_profiles.activo = true
  );
$$;

CREATE OR REPLACE FUNCTION current_user_employee_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM empleados
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- Auth → Empleados Sync Trigger
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_auth_user_to_empleado()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_default_society uuid;
  v_empleado_exists boolean;
  v_first_society_text text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS(SELECT 1 FROM empleados WHERE user_id = NEW.id)
    INTO v_empleado_exists;
    
    IF NOT v_empleado_exists THEN
      IF NEW.societies IS NOT NULL AND array_length(NEW.societies, 1) > 0 THEN
        v_first_society_text := NEW.societies[1];
        BEGIN
          v_default_society := v_first_society_text::uuid;
        EXCEPTION WHEN OTHERS THEN
          SELECT id INTO v_default_society FROM sociedades LIMIT 1;
        END;
      ELSE
        SELECT id INTO v_default_society FROM sociedades LIMIT 1;
      END IF;
      
      IF v_default_society IS NOT NULL THEN
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
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_auth_user_to_empleado ON user_profiles;

CREATE TRIGGER trg_sync_auth_user_to_empleado
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_auth_user_to_empleado();

-- ─────────────────────────────────────────────────────────────────────
-- Cascading Delete Fix
-- ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  ALTER TABLE empleados DROP CONSTRAINT IF EXISTS empleados_user_id_fkey;
  
  ALTER TABLE empleados
    ADD CONSTRAINT empleados_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES user_profiles(id)
    ON DELETE CASCADE;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- Enhanced RLS Policies
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Employee can view own empleado record" ON empleados;
DROP POLICY IF EXISTS "Admin or RRHH can view all empleados" ON empleados;

CREATE POLICY "Admin or RRHH view all empleados"
  ON empleados FOR SELECT
  TO authenticated
  USING (is_admin_or_rrhh());

CREATE POLICY "Employee view own empleado"
  ON empleados FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Employee update own empleado"
  ON empleados FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- Society Isolation
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Any authenticated can view sociedades" ON sociedades;

CREATE POLICY "Admin RRHH view all societies"
  ON sociedades FOR SELECT
  TO authenticated
  USING (is_admin_or_rrhh());

CREATE POLICY "Employee view assigned societies"
  ON sociedades FOR SELECT
  TO authenticated
  USING (
    is_employee_activo()
    AND id::text = ANY(COALESCE((SELECT societies FROM user_profiles WHERE id = auth.uid()), ARRAY[]::text[]))
  );

-- ─────────────────────────────────────────────────────────────────────
-- Backfill Orphaned Records
-- ─────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user_rec user_profiles%ROWTYPE;
  v_society_id uuid;
  v_first_society_text text;
BEGIN
  FOR v_user_rec IN
    SELECT up.* FROM user_profiles up
    LEFT JOIN empleados e ON e.user_id = up.id
    WHERE e.id IS NULL
    LIMIT 100
  LOOP
    IF v_user_rec.societies IS NOT NULL AND array_length(v_user_rec.societies, 1) > 0 THEN
      v_first_society_text := v_user_rec.societies[1];
      BEGIN
        v_society_id := v_first_society_text::uuid;
      EXCEPTION WHEN OTHERS THEN
        SELECT id INTO v_society_id FROM sociedades LIMIT 1;
      END;
    ELSE
      SELECT id INTO v_society_id FROM sociedades LIMIT 1;
    END IF;
    
    IF v_society_id IS NOT NULL THEN
      INSERT INTO empleados (
        user_id,
        id_sociedad,
        nombre,
        email,
        activo
      ) VALUES (
        v_user_rec.id,
        v_society_id,
        COALESCE(v_user_rec.nombre, ''),
        COALESCE(v_user_rec.email, ''),
        COALESCE(v_user_rec.activo, true)
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
