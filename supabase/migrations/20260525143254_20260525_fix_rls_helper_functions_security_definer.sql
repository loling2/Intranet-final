/*
  # Fix RLS helper functions — add SECURITY DEFINER

  is_admin(), is_admin_or_rrhh() e is_prevencion() consultaban user_profiles
  dentro de políticas de user_profiles, causando recursión infinita ("Database
  error querying schema") al hacer login con usuarios no-admin.

  La solución es marcarlas SECURITY DEFINER + SET search_path = public para que
  se ejecuten con los permisos del owner (postgres) y NO pasen por RLS, rompiendo
  el ciclo.
*/

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND activo = true
  );
$$;

CREATE OR REPLACE FUNCTION is_admin_or_rrhh()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'rrhh')
      AND activo = true
  );
$$;

CREATE OR REPLACE FUNCTION is_prevencion()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'prevencion'
  );
$$;
