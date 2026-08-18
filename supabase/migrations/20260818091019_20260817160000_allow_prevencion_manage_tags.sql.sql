/*
# Allow Prevencion to manage PRL tags

1. Security changes
- Replaces the INSERT, UPDATE and DELETE policies on `tags` so that
  `prevencion` can also create, edit and delete tags, not just admin/rrhh.
- This matches the existing permissions on `etiquetado`, where prevencion
  already has full CRUD. Without this, a prevencion user sees the Tags PRL
  panel but every "Crear tag" attempt fails with
  "new row violates row-level security policy for table tags".
- SELECT policy is unchanged (already open to all authenticated users).
- DROP + CREATE makes each policy idempotent.

2. Notes
- The helper is_admin() / is_admin_or_rrhh() are unchanged.
- A new inline predicate checks user_profiles.role IN
  ('admin','rrhh','prevencion') with activo = true, mirroring the
  etiquetado policies.
*/

DROP POLICY IF EXISTS "Admin or RRHH can insert tags" ON tags;
CREATE POLICY "Admin RRHH Prevencion can insert tags"
ON tags FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['admin','rrhh','prevencion'])
    AND user_profiles.activo = true
  )
);

DROP POLICY IF EXISTS "Admin or RRHH can update tags" ON tags;
CREATE POLICY "Admin RRHH Prevencion can update tags"
ON tags FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['admin','rrhh','prevencion'])
    AND user_profiles.activo = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['admin','rrhh','prevencion'])
    AND user_profiles.activo = true
  )
);

DROP POLICY IF EXISTS "Admin can delete tags" ON tags;
CREATE POLICY "Admin RRHH Prevencion can delete tags"
ON tags FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = ANY (ARRAY['admin','rrhh','prevencion'])
    AND user_profiles.activo = true
  )
);