/*
# Allow Prevencion to read supervisor_centros

1. Problem
- The supervisor_centros SELECT policy only allows admin/rrhh or the assigned supervisor.
- Now that centros can have RRHH and Prevencion users as responsables, prevencion users need read access too.

2. Security changes
- Drop and recreate the SELECT policy to also allow is_prevencion().
- INSERT/UPDATE/DELETE policies: also allow is_prevencion() so prevencion users can assign responsables.
*/

DROP POLICY IF EXISTS "select_supervisor_centros" ON public.supervisor_centros;
CREATE POLICY "select_supervisor_centros" ON public.supervisor_centros FOR SELECT
  TO authenticated USING (
    is_admin_or_rrhh()
    OR is_prevencion()
    OR (supervisor_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_supervisor_centros" ON public.supervisor_centros;
CREATE POLICY "insert_supervisor_centros" ON public.supervisor_centros FOR INSERT
  TO authenticated WITH CHECK (
    is_admin_or_rrhh() OR is_prevencion()
  );

DROP POLICY IF EXISTS "update_supervisor_centros" ON public.supervisor_centros;
CREATE POLICY "update_supervisor_centros" ON public.supervisor_centros FOR UPDATE
  TO authenticated USING (
    is_admin_or_rrhh() OR is_prevencion()
  ) WITH CHECK (
    is_admin_or_rrhh() OR is_prevencion()
  );

DROP POLICY IF EXISTS "delete_supervisor_centros" ON public.supervisor_centros;
CREATE POLICY "delete_supervisor_centros" ON public.supervisor_centros FOR DELETE
  TO authenticated USING (
    is_admin_or_rrhh() OR is_prevencion()
  );