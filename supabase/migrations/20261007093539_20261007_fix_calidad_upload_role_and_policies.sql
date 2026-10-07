/*
# Fix Calidad document uploads for multi-role users

## Purpose
Allow an authenticated user who has Calidad in either the primary role or the additional roles list to upload and manage Calidad documents.

## Modified database objects
- `public.insert_calidad_documentos` — recognizes the `calidad` role in both `user_profiles.role` and `user_profiles.roles`.
- `public.update_calidad_documentos` — uses the same multi-role check.
- `public.delete_calidad_documentos` — uses the same multi-role check.

## Security
- Only authenticated administrators or users explicitly assigned the Calidad role can insert, update, or delete Calidad documents.
- The role is read from the server-side user profile associated with `auth.uid()`; the browser cannot grant itself access.
- No tables, columns, storage objects, or existing documents are changed.

## Important notes
1. This fixes accounts that access the Calidad panel through a secondary profile while their primary role is another profile such as Formacion or Prevencion.
2. The existing read policy remains unchanged.
3. The policies remain separate by operation as required by row-level security.
*/

DROP POLICY IF EXISTS "insert_calidad_documentos" ON public.calidad_documentos;
CREATE POLICY "insert_calidad_documentos"
ON public.calidad_documentos FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role = 'calidad' OR 'calidad' = ANY(COALESCE(up.roles, ARRAY[]::text[])))
  )
);

DROP POLICY IF EXISTS "update_calidad_documentos" ON public.calidad_documentos;
CREATE POLICY "update_calidad_documentos"
ON public.calidad_documentos FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role = 'calidad' OR 'calidad' = ANY(COALESCE(up.roles, ARRAY[]::text[])))
  )
)
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role = 'calidad' OR 'calidad' = ANY(COALESCE(up.roles, ARRAY[]::text[])))
  )
);

DROP POLICY IF EXISTS "delete_calidad_documentos" ON public.calidad_documentos;
CREATE POLICY "delete_calidad_documentos"
ON public.calidad_documentos FOR DELETE
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role = 'calidad' OR 'calidad' = ANY(COALESCE(up.roles, ARRAY[]::text[])))
  )
);