/*
# Fix Gerontalia scope leak on documents, vehicles, and is_staff

1. Purpose
- Gerontalia roles were seeing and modifying data from ALL societies because:
  a) is_staff() included Gerontalia roles, granting global INSERT/DELETE on documents and vehicles.
  b) select_documents had USING(true), so Gerontalia saw all documents.
  c) select_vehicles had USING(true), so Gerontalia saw all vehicles.
  d) update_vehicles had USING(true) WITH CHECK(true), so Gerontalia could update any vehicle.

2. Function changes
- is_staff() now excludes all *_gerontalia roles. Gerontalia roles get access via
  their own scoped policies (is_gerontalia_scoped + society filter) instead.

3. Policy changes on documents
- select_documents: changed from USING(true) to USING(NOT is_gerontalia_scoped()
  OR society_id = my_scope_society_id()::text). Non-gerontalia users see all;
  Gerontalia users see only their society.
- insert_documents: changed from is_staff() to (is_staff() OR (is_gerontalia_scoped()
  AND society_id = my_scope_society_id()::text)).
- delete_documents: same pattern as insert.

4. Policy changes on vehicles
- select_vehicles: changed from USING(true) to USING(NOT is_gerontalia_scoped()
  OR society_id = my_scope_society_id()::text).
- update_vehicles: changed from USING(true) WITH CHECK(true) to
  USING(NOT is_gerontalia_scoped() OR society_id = my_scope_society_id()::text)
  WITH CHECK(NOT is_gerontalia_scoped() OR society_id = my_scope_society_id()::text).
- insert_vehicles: changed from is_staff() to (is_staff() OR (is_gerontalia_scoped()
  AND society_id = my_scope_society_id()::text)).

5. Security result
- Gerontalia roles can only SELECT, INSERT, UPDATE, DELETE rows where society_id
  matches their assigned society (6632d8d1-...).
- Global roles (admin, rrhh, prevencion, supervisor, etc.) keep full access.
- No data is lost; no tables or columns are dropped or renamed.

6. Important notes
- documents.society_id and vehicles.society_id are text, so my_scope_society_id()
  is cast to text.
- The existing gerontalia_* policies on vehicles are redundant now but harmless;
  they are left in place to avoid unnecessary churn.
*/

-- 1. Fix is_staff() to exclude Gerontalia roles
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
        'admin', 'rrhh', 'prevencion', 'supervisor',
        'administracion', 'calidad', 'formacion'
      )
  );
$$;

-- 2. Fix documents SELECT policy
DROP POLICY IF EXISTS "select_documents" ON documents;
CREATE POLICY "select_documents" ON documents FOR SELECT
  TO anon, authenticated
  USING (NOT is_gerontalia_scoped() OR society_id = my_scope_society_id()::text);

-- 3. Fix documents INSERT policy
DROP POLICY IF EXISTS "insert_documents" ON documents;
CREATE POLICY "insert_documents" ON documents FOR INSERT
  TO authenticated
  WITH CHECK (is_staff() OR (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text));

-- 4. Fix documents DELETE policy
DROP POLICY IF EXISTS "delete_documents" ON documents;
CREATE POLICY "delete_documents" ON documents FOR DELETE
  TO authenticated
  USING (is_staff() OR (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text));

-- 5. Fix vehicles SELECT policy
DROP POLICY IF EXISTS "select_vehicles" ON vehicles;
CREATE POLICY "select_vehicles" ON vehicles FOR SELECT
  TO anon, authenticated
  USING (NOT is_gerontalia_scoped() OR society_id = my_scope_society_id()::text);

-- 6. Fix vehicles UPDATE policy
DROP POLICY IF EXISTS "update_vehicles" ON vehicles;
CREATE POLICY "update_vehicles" ON vehicles FOR UPDATE
  TO authenticated
  USING (NOT is_gerontalia_scoped() OR society_id = my_scope_society_id()::text)
  WITH CHECK (NOT is_gerontalia_scoped() OR society_id = my_scope_society_id()::text);

-- 7. Fix vehicles INSERT policy
DROP POLICY IF EXISTS "insert_vehicles" ON vehicles;
CREATE POLICY "insert_vehicles" ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (is_staff() OR (is_gerontalia_scoped() AND society_id = my_scope_society_id()::text));
