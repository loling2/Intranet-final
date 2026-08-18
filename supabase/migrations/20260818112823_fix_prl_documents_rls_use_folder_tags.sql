/*
# Fix prl_documents SELECT RLS to use prl_folder_tags (multi-tag)

## Problem
The existing RLS policy "prl_documents select with tag access control" used
`prl_folders.access_tag_id` (a single legacy tag column) instead of the
`prl_folder_tags` join table (which supports multiple tags per folder).
It also allowed access when `access_tag_id IS NULL`, which opened folders
with no legacy tag to ALL authenticated users — so an employee like Dolores
could see documents from folders she had no tag for.

## Fix
Replace the SELECT policy with one that mirrors the logic in
`get_my_prl_documents()`:
  - admin/rrhh/prevencion → see everything
  - otherwise → only if the folder has at least one tag in prl_folder_tags
    that matches a tag assigned to the employee (via etiquetado), OR the
    folder has a department in prl_folder_departamentos that the employee
    belongs to (via empleados_departamentos_prl).
No "open to all" fallback: folders with no tags and no departments are
visible only to admin/rrhh/prevencion.

## Security
- Drops and recreates the SELECT policy on prl_documents.
- No data changes.
*/

DROP POLICY IF EXISTS "prl_documents select with tag access control" ON prl_documents;
DROP POLICY IF EXISTS "prl_documents select own tags" ON prl_documents;

CREATE POLICY "prl_documents select own tags"
ON prl_documents FOR SELECT
TO authenticated
USING (
  -- Admin / RRHH / Prevencion see all PRL documents
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = ANY (ARRAY['admin'::text, 'rrhh'::text, 'prevencion'::text])
  )
  OR (
    -- Folder has tags → employee must have at least one matching tag
    EXISTS (
      SELECT 1
      FROM prl_folder_tags pft
      JOIN etiquetado et ON et.tag_id = pft.tag_id
      JOIN empleados emp ON emp.id = et.entidad_id AND emp.user_id = auth.uid()
      WHERE pft.folder_id = prl_documents.folder_id
    )
    -- Folder has departments → employee must be in at least one matching department
    OR EXISTS (
      SELECT 1
      FROM prl_folder_departamentos pfd
      JOIN empleados_departamentos_prl edp ON edp.departamento_prl_id = pfd.departamento_prl_id
      JOIN empleados emp ON emp.id = edp.empleado_id AND emp.user_id = auth.uid()
      WHERE pfd.folder_id = prl_documents.folder_id
    )
  )
);
