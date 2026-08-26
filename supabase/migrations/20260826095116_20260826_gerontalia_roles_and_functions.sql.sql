-- Part 1: Roles and helper functions

INSERT INTO app_roles (id, name, description)
VALUES
  (gen_random_uuid(), 'rrhh_gerontalia', 'RRHH exclusivo de Gerontalia'),
  (gen_random_uuid(), 'administrador_gerontalia', 'Administrador exclusivo de Gerontalia'),
  (gen_random_uuid(), 'supervisor_gerontalia', 'Supervisor exclusivo de Gerontalia')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.my_scope_society_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('rrhh_gerontalia', 'administrador_gerontalia', 'supervisor_gerontalia')
    ) THEN '6632d8d1-c4e7-4540-aab7-515b9d7913f7'::uuid
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_gerontalia_scoped()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT my_scope_society_id() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'administrador_gerontalia')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_rrhh()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin','rrhh','administrador_gerontalia','rrhh_gerontalia')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin','rrhh','supervisor','administrador_gerontalia','rrhh_gerontalia','supervisor_gerontalia')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin','rrhh','prevencion','supervisor','administracion','calidad','formacion',
                   'administrador_gerontalia','rrhh_gerontalia','supervisor_gerontalia')
  );
$$;
