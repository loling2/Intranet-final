/*
# Multi-role support for user_profiles

1. Problem
- user_profiles.role is a single text column. Each user gets exactly one role.
- The user wants to assign multiple profiles per person, with "empleado" always visible.

2. Schema change
- Add `roles` text[] column, default '{}'.
- Backfill: set roles = ARRAY[role] for existing rows (so nobody loses access).
- Keep the `role` column as-is for backward compatibility; RLS functions will
  check BOTH `role` and `roles` so existing single-role users keep working
  until an admin updates them via the new multi-select UI.

3. RLS function updates
- is_admin: checks role IN (...) OR 'admin' = ANY(roles)
- is_admin_or_rrhh: checks role IN (...) OR roles && ARRAY[...]
- is_prevencion: checks role = 'prevencion' OR 'prevencion' = ANY(roles)
- is_staff: checks role IN (...) OR roles && ARRAY[...]
- my_scope_society_id: checks role IN (gerontalia roles) OR roles && gerontalia roles

4. Data safety
- No columns or rows removed. The `role` column is preserved.
*/

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS roles text[] DEFAULT '{}';

UPDATE public.user_profiles
  SET roles = ARRAY[role]
  WHERE roles = '{}' OR roles IS NULL;

-- Updated RLS helper functions to check both role and roles array

CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
  SET row_security TO 'off'
AS $function$
SELECT EXISTS (
  SELECT 1
  FROM public.user_profiles
  WHERE id = auth.uid()
  AND (
    role IN ('admin', 'administrador_gerontalia')
    OR 'admin' = ANY(roles)
    OR 'administrador_gerontalia' = ANY(roles)
  )
);
$function$;

CREATE OR REPLACE FUNCTION public.is_admin_or_rrhh()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
  SET row_security TO 'off'
AS $function$
SELECT EXISTS (
  SELECT 1
  FROM public.user_profiles
  WHERE id = auth.uid()
  AND (
    role IN ('admin', 'rrhh')
    OR roles && ARRAY['admin', 'rrhh']
  )
);
$function$;

CREATE OR REPLACE FUNCTION public.is_prevencion()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
  SET row_security TO 'off'
AS $function$
SELECT EXISTS (
  SELECT 1
  FROM public.user_profiles
  WHERE id = auth.uid()
  AND (
    role = 'prevencion'
    OR 'prevencion' = ANY(roles)
  )
);
$function$;

CREATE OR REPLACE FUNCTION public.is_staff()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
  SET row_security TO 'off'
AS $function$
SELECT EXISTS (
  SELECT 1
  FROM public.user_profiles
  WHERE id = auth.uid()
  AND (
    role IN (
      'admin', 'rrhh', 'prevencion', 'supervisor',
      'administracion', 'calidad', 'formacion'
    )
    OR roles && ARRAY[
      'admin', 'rrhh', 'prevencion', 'supervisor',
      'administracion', 'calidad', 'formacion'
    ]
  )
);
$function$;

CREATE OR REPLACE FUNCTION public.my_scope_society_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
  SET row_security TO 'off'
AS $function$
SELECT CASE
WHEN EXISTS (
  SELECT 1 FROM public.user_profiles
  WHERE id = auth.uid()
  AND (
    role IN ('rrhh_gerontalia','administrador_gerontalia','supervisor_gerontalia','prevencion_gerontalia')
    OR roles && ARRAY['rrhh_gerontalia','administrador_gerontalia','supervisor_gerontalia','prevencion_gerontalia']
  )
) THEN '6632d8d1-c4e7-4540-aab7-515b9d7913f7'::uuid
ELSE NULL
END;
$function$;