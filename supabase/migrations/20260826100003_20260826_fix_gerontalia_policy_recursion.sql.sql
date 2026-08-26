/*
# Fix Gerontalia RLS recursion and preserve global access

1. Purpose
- Stop the infinite recursion reported when loading empleados, centros and user_profiles.
- Keep the existing global roles working with their previous access rules.
- Keep the three Gerontalia roles restricted to the Gerontalia society.

2. Security changes
- Helper functions that read user_profiles now explicitly bypass table RLS as trusted SECURITY DEFINER helpers.
- This prevents the circular evaluation between empleados policies and user_profiles policies.
- No rows, columns, tables, or existing global policies are deleted.

3. Important notes
- The bypass applies only inside these role-check helpers; users still access data through RLS policies.
- The Gerontalia society remains 6632d8d1-c4e7-4540-aab7-515b9d7913f7.
*/

CREATE OR REPLACE FUNCTION public.my_scope_society_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.user_profiles
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
SET row_security TO 'off'
AS $$
  SELECT public.my_scope_society_id() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'administrador_gerontalia')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_rrhh()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'rrhh', 'administrador_gerontalia', 'rrhh_gerontalia')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN (
        'admin', 'rrhh', 'supervisor',
        'administrador_gerontalia', 'rrhh_gerontalia', 'supervisor_gerontalia'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN (
        'admin', 'rrhh', 'prevencion', 'supervisor', 'administracion', 'calidad', 'formacion',
        'administrador_gerontalia', 'rrhh_gerontalia', 'supervisor_gerontalia'
      )
  );
$$;
