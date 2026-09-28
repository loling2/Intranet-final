/*
# Fix reset_prl_assignments: add WHERE clause to unconditional DELETEs

Supabase's PostgREST safe-delete protection blocks DELETE statements
without a WHERE clause, even inside SECURITY DEFINER functions.
Adding `WHERE true` satisfies the check.
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
    SELECT role INTO v_caller_role
    FROM user_profiles
    WHERE id = auth.uid()
    LIMIT 1;

    IF v_caller_role IS NULL OR v_caller_role <> 'admin' THEN
        RAISE EXCEPTION 'No autorizado. Solo el administrador puede reiniciar las asignaciones PRL.';
    END IF;

    DELETE FROM prl_document_puesto_tags WHERE true;
    DELETE FROM etiquetado WHERE tag_id IN (SELECT id FROM tags);
    DELETE FROM empleados_departamentos_prl WHERE true;
    DELETE FROM employee_centro_history WHERE true;
    UPDATE empleados SET centro_id = NULL WHERE centro_id IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_prl_assignments() FROM anon;
GRANT EXECUTE ON FUNCTION public.reset_prl_assignments() TO authenticated;