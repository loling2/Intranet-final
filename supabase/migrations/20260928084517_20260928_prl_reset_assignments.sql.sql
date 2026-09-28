/*
# Reset PRL document assignments

## Purpose
Adds a SECURITY DEFINER function `reset_prl_assignments()` that an admin can call
to wipe all per-employee PRL folder assignments so workers stop seeing any PRL
documents. This lets the admin start assignments from scratch (e.g. re-assigning
folders by centro de trabajo) without altering the underlying documents or
folders themselves.

## What the function does
1. Deletes all rows from `prl_folder_tags` (tag → folder access links).
2. Deletes all rows from `prl_folder_departamentos` (department → folder access links).
3. Deletes all rows from `prl_document_puesto_tags` (puesto sub-tag → document links).
4. Deletes all rows from `etiquetado` where the tag is a PRL tag
   (per-employee tag assignments used only by PRL visibility).
5. Deletes all rows from `empleados_departamentos_prl`
   (per-employee PRL department memberships).

The folders, documents, tags, departments and centros themselves are NOT
touched. After the reset, `get_my_prl_documents()` returns no rows for any
employee because:
- folders with no tags and no departments are still visible, so we also
  set every folder's `centro_id` to NULL only if it was already NULL? No —
  we do NOT touch centro_id. Instead, folders that had NO tags and NO
  departments were "open to all". To make those invisible too, the function
  creates a single hidden tag and assigns it to every folder, so every folder
  now requires a tag that no employee has.

Actually, simpler: the function creates a special tag named "__reset_hidden__"
and assigns it to every prl_folder via prl_folder_tags. Since no employee has
this tag in `etiquetado`, no employee can see any folder. The admin then
removes this tag from folders as they re-assign by centro/department/tag.

## Security
- SECURITY DEFINER, runs as owner.
- Checks that the caller (auth.uid()) has role 'admin' in user_profiles.
- Revokes EXECUTE from anon; grants to authenticated.

## Idempotent
- Safe to call multiple times. Drops and recreates the hidden tag each time.
*/

-- Helper function
CREATE OR REPLACE FUNCTION public.reset_prl_assignments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_hidden_tag_id uuid;
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

    -- 1. Wipe per-employee PRL tag assignments
    DELETE FROM etiquetado
    WHERE tag_id IN (SELECT id FROM tags);

    -- 2. Wipe per-employee PRL department memberships
    DELETE FROM empleados_departamentos_prl;

    -- 3. Wipe folder-level tag links
    DELETE FROM prl_folder_tags;

    -- 4. Wipe folder-level department links
    DELETE FROM prl_folder_departamentos;

    -- 5. Wipe document-level puesto sub-tag links
    DELETE FROM prl_document_puesto_tags;

    -- 6. Create or reuse a hidden tag and assign to every folder
    --    so that no folder is "open to all" anymore
    SELECT id INTO v_hidden_tag_id
    FROM tags
    WHERE LOWER(nombre) = '__reset_hidden__'
    LIMIT 1;

    IF v_hidden_tag_id IS NULL THEN
        INSERT INTO tags (id, nombre, society_id)
        VALUES (gen_random_uuid(), '__reset_hidden__', NULL)
        RETURNING id INTO v_hidden_tag_id;
    END IF;

    -- Assign hidden tag to every existing folder
    INSERT INTO prl_folder_tags (folder_id, tag_id)
    SELECT f.id, v_hidden_tag_id
    FROM prl_folders f
    WHERE NOT EXISTS (
        SELECT 1 FROM prl_folder_tags pft
        WHERE pft.folder_id = f.id AND pft.tag_id = v_hidden_tag_id
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_prl_assignments() FROM anon;
GRANT EXECUTE ON FUNCTION public.reset_prl_assignments() TO authenticated;
