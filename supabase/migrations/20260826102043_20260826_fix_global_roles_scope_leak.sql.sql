/*
# Separate global roles from Gerontalia-scoped roles

1. Purpose
- Prevent Gerontalia roles from receiving the global all-societies permissions.
- The affected roles are rrhh_gerontalia, administrador_gerontalia,
  supervisor_gerontalia, and prevencion_gerontalia.

2. Function changes
- is_admin_or_rrhh() now recognizes only admin and global rrhh.
- is_admin_or_supervisor() now recognizes only admin, global rrhh, and global supervisor.
- is_prevencion() now recognizes only global prevencion.
- The Gerontalia roles continue to use is_gerontalia_scoped() and
  my_scope_society_id() for society-filtered access.

3. Security result
- Existing policies using the global helper functions no longer grant all-society
  access to Gerontalia roles.
- Existing Gerontalia-scoped policies remain responsible for their allowed society.
- No rows, columns, tables, or users are deleted or modified.

4. Important notes
- Global profiles keep their existing all-society access.
- Gerontalia profiles must have a role ending in _gerontalia and are restricted to
  society 6632d8d1-c4e7-4540-aab7-515b9d7913f7 by the existing scoped policies.
*/

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
      AND role IN ('admin', 'rrhh')
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
      AND role IN ('admin', 'rrhh', 'supervisor')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_prevencion()
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
      AND role = 'prevencion'
  );
$$;
