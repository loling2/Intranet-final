/*
# Update reset_prl_assignments: reset per-employee and per-document data only

## Purpose
Updated version of reset_prl_assignments(). The previous version wiped
folder-level tags and added a hidden tag to every folder, which broke
centro-based visibility. This version ONLY resets per-employee and
per-document assignment data so workers start from zero, while folder-level
configuration (centro, tags, departments) remains untouched.

## What the function does
1. Clears prl_document_puesto_tags — per-document puesto sub-tag assignments
   (so the admin can start assigning puesto tags to documents from scratch).
2. Clears etiquetado where the tag is a PRL tag — per-employee tag assignments
   used by PRL visibility (test data from workers who were testing).
3. Clears empleados_departamentos_prl — per-employee PRL department memberships.
4. Clears employee_centro_history — historical centro assignments from test clock-ins.
5. Sets empleados.centro_id = NULL for ALL employees — so they start with no
   centro and get assigned one when they next clock in on a tablet.

## What is NOT touched
- prl_folders (the folders themselves)
- prl_documents (the documents themselves)
- prl_folder_tags (folder-level tag access control)
- prl_folder_departamentos (folder-level department access control)
- tags, departamentos_prl, puesto_tags (the tag/department definitions)
- centros (the center definitions)

## Result after reset
- Workers have no centro assigned → see no PRL documents.
- As they clock in on tablets, they get assigned the tablet's centro
  and start seeing documents for that centro (current behavior, unchanged).
- The admin can then assign puesto tags to individual documents so each
  worker only sees documents for their job position.
- Folder-level access control (tags, departments, centro) remains intact.

## Security
- SECURITY DEFINER, checks caller has role 'admin'.
- Revokes EXECUTE from anon; grants to authenticated.
*/

CREATE OR REPLACE FUNCTION public.reset_prl_assignments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_caller_role text;
BEGIN
    -- Authorize: only admin can reset
    SELECT role INTO v_caller_role
    FROM user_profiles
    WHERE id = auth.uid()
    LIMIT 1;

    IF v_caller_role IS NULL OR v_caller_role <> 'admin' THEN
        RAISE EXCEPTION 'No autorizado. Solo el administrador puede reiniciar las asignaciones PRL.';
    END IF;

    -- 1. Clear per-document puesto sub-tag assignments
    DELETE FROM prl_document_puesto_tags;

    -- 2. Clear per-employee PRL tag assignments (etiquetado)
    DELETE FROM etiquetado
    WHERE tag_id IN (SELECT id FROM tags);

    -- 3. Clear per-employee PRL department memberships
    DELETE FROM empleados_departamentos_prl;

    -- 4. Clear historical centro assignments from test clock-ins
    DELETE FROM employee_centro_history;

    -- 5. Reset current centro for all employees so they start fresh
    UPDATE empleados SET centro_id = NULL WHERE centro_id IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_prl_assignments() FROM anon;
GRANT EXECUTE ON FUNCTION public.reset_prl_assignments() TO authenticated;
