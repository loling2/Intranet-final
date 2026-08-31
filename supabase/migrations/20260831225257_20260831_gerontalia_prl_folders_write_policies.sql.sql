/*
# Fix: Gerontalia prevención cannot create PRL folders

## Problem
- The migration `20260826_fix_global_roles_scope_leak` redefined `is_prevencion()`
  to only include role = 'prevencion', removing 'prevencion_gerontalia'.
- No gerontalia-scoped INSERT/UPDATE/DELETE policies were added on prl_folders,
  prl_folder_tags, or prl_folder_departamentos to compensate.
- Result: prevencion_gerontalia users get "Error al guardar" when creating PRL folders.

## Fix
- Add gerontalia-scoped INSERT/UPDATE/DELETE policies on:
  1. prl_folders — society_id is UUID, compare with my_scope_society_id() directly
  2. prl_folder_tags — scoped via join to prl_folders
  3. prl_folder_departamentos — scoped via join to prl_folders
  4. departamentos_prl — scoped by is_gerontalia_scoped()
- All new policies are additive; no existing policies are modified.
*/

-- ── prl_folders: gerontalia INSERT/UPDATE/DELETE ─────────────────────────────

DROP POLICY IF EXISTS "gerontalia_insert_prl_folders" ON prl_folders;
CREATE POLICY "gerontalia_insert_prl_folders" ON prl_folders FOR INSERT
  TO authenticated
  WITH CHECK (is_gerontalia_scoped() AND society_id = my_scope_society_id());

DROP POLICY IF EXISTS "gerontalia_update_prl_folders" ON prl_folders;
CREATE POLICY "gerontalia_update_prl_folders" ON prl_folders FOR UPDATE
  TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id())
  WITH CHECK (is_gerontalia_scoped() AND society_id = my_scope_society_id());

DROP POLICY IF EXISTS "gerontalia_delete_prl_folders" ON prl_folders;
CREATE POLICY "gerontalia_delete_prl_folders" ON prl_folders FOR DELETE
  TO authenticated
  USING (is_gerontalia_scoped() AND society_id = my_scope_society_id());

-- ── prl_folder_tags: gerontalia INSERT/UPDATE/DELETE ──────────────────────────

DROP POLICY IF EXISTS "gerontalia_insert_prl_folder_tags" ON prl_folder_tags;
CREATE POLICY "gerontalia_insert_prl_folder_tags" ON prl_folder_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM prl_folders f
      WHERE f.id = prl_folder_tags.folder_id
        AND f.society_id = my_scope_society_id()
    )
  );

DROP POLICY IF EXISTS "gerontalia_update_prl_folder_tags" ON prl_folder_tags;
CREATE POLICY "gerontalia_update_prl_folder_tags" ON prl_folder_tags FOR UPDATE
  TO authenticated
  USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM prl_folders f
      WHERE f.id = prl_folder_tags.folder_id
        AND f.society_id = my_scope_society_id()
    )
  )
  WITH CHECK (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM prl_folders f
      WHERE f.id = prl_folder_tags.folder_id
        AND f.society_id = my_scope_society_id()
    )
  );

DROP POLICY IF EXISTS "gerontalia_delete_prl_folder_tags" ON prl_folder_tags;
CREATE POLICY "gerontalia_delete_prl_folder_tags" ON prl_folder_tags FOR DELETE
  TO authenticated
  USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM prl_folders f
      WHERE f.id = prl_folder_tags.folder_id
        AND f.society_id = my_scope_society_id()
    )
  );

-- ── prl_folder_departamentos: gerontalia INSERT/UPDATE/DELETE ────────────────

DROP POLICY IF EXISTS "gerontalia_insert_prl_folder_departamentos" ON prl_folder_departamentos;
CREATE POLICY "gerontalia_insert_prl_folder_departamentos" ON prl_folder_departamentos FOR INSERT
  TO authenticated
  WITH CHECK (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM prl_folders f
      WHERE f.id = prl_folder_departamentos.folder_id
        AND f.society_id = my_scope_society_id()
    )
  );

DROP POLICY IF EXISTS "gerontalia_update_prl_folder_departamentos" ON prl_folder_departamentos;
CREATE POLICY "gerontalia_update_prl_folder_departamentos" ON prl_folder_departamentos FOR UPDATE
  TO authenticated
  USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM prl_folders f
      WHERE f.id = prl_folder_departamentos.folder_id
        AND f.society_id = my_scope_society_id()
    )
  )
  WITH CHECK (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM prl_folders f
      WHERE f.id = prl_folder_departamentos.folder_id
        AND f.society_id = my_scope_society_id()
    )
  );

DROP POLICY IF EXISTS "gerontalia_delete_prl_folder_departamentos" ON prl_folder_departamentos;
CREATE POLICY "gerontalia_delete_prl_folder_departamentos" ON prl_folder_departamentos FOR DELETE
  TO authenticated
  USING (
    is_gerontalia_scoped() AND EXISTS (
      SELECT 1 FROM prl_folders f
      WHERE f.id = prl_folder_departamentos.folder_id
        AND f.society_id = my_scope_society_id()
    )
  );

-- ── departamentos_prl: gerontalia INSERT/UPDATE/DELETE ────────────────────────

DROP POLICY IF EXISTS "gerontalia_insert_departamentos_prl" ON departamentos_prl;
CREATE POLICY "gerontalia_insert_departamentos_prl" ON departamentos_prl FOR INSERT
  TO authenticated
  WITH CHECK (is_gerontalia_scoped());

DROP POLICY IF EXISTS "gerontalia_update_departamentos_prl" ON departamentos_prl;
CREATE POLICY "gerontalia_update_departamentos_prl" ON departamentos_prl FOR UPDATE
  TO authenticated
  USING (is_gerontalia_scoped())
  WITH CHECK (is_gerontalia_scoped());

DROP POLICY IF EXISTS "gerontalia_delete_departamentos_prl" ON departamentos_prl;
CREATE POLICY "gerontalia_delete_departamentos_prl" ON departamentos_prl FOR DELETE
  TO authenticated
  USING (is_gerontalia_scoped());
