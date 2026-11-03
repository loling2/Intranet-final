/*
# Seguros: acceso completo para el perfil Administracion

1. Summary
- The Seguros table previously allowed only users with the global admin role.
- Users whose profile is Administracion (role or extra roles) now get the same full access.

2. Modified objects
- Table `seguros`: the four existing policies (select, insert, update, delete) are replaced.
- No columns, data or grants are changed.

3. Security
- Access is still limited to authenticated users with admin or administracion profile.
- Other profiles keep no access to seguros.

4. Notes
- Idempotent: policies are dropped with IF EXISTS before being recreated.
*/

CREATE OR REPLACE FUNCTION public.is_admin_or_administracion()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM public.user_profiles
  WHERE id = auth.uid()
  AND (
    role IN ('admin', 'administracion')
    OR roles && ARRAY['admin', 'administracion']::text[]
  )
);
$function$;

DROP POLICY IF EXISTS admin_select_seguros ON public.seguros;
CREATE POLICY admin_select_seguros ON public.seguros FOR SELECT
TO authenticated USING (public.is_admin_or_administracion());

DROP POLICY IF EXISTS admin_insert_seguros ON public.seguros;
CREATE POLICY admin_insert_seguros ON public.seguros FOR INSERT
TO authenticated WITH CHECK (public.is_admin_or_administracion());

DROP POLICY IF EXISTS admin_update_seguros ON public.seguros;
CREATE POLICY admin_update_seguros ON public.seguros FOR UPDATE
TO authenticated USING (public.is_admin_or_administracion()) WITH CHECK (public.is_admin_or_administracion());

DROP POLICY IF EXISTS admin_delete_seguros ON public.seguros;
CREATE POLICY admin_delete_seguros ON public.seguros FOR DELETE
TO authenticated USING (public.is_admin_or_administracion());
