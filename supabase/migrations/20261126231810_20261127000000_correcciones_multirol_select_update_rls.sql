/*
# Multi-role + center-scoped access for fichajes_correcciones

1. Problem
- The SELECT/UPDATE policies on fichajes_correcciones only read the single
  column user_profiles.role. Users whose roles live in the user_profiles.roles
  array (multi-role support, e.g. a coordinador or rrhh_gerontalia stored only
  in roles) were invisible to the policies.
- rrhh_gerontalia only saw rows with sociedad_id equal to the Gerontalia
  society; rows created before that column existed (or with NULL) were hidden.
- Supervisor/coordinador visibility relied on the client's per-employee filter;
  the policies themselves only matched employees linked through
  supervisor_centros by center, not the full existing helper.

2. Changes

### 2.1 New SECURITY DEFINER helpers (both role + roles aware)
- has_any_role(roles text[]): true if the caller's user_profiles row (activo)
  has any of the given roles in role OR roles.
- puede_ver_empleado(p_empleado_id uuid): true if the caller is a supervisor
  or coordinador whose scope (supervisor_asignaciones, supervisor_centros,
  coordinador_supervisores chain) covers that employee. Mirrors the existing
  supervisor_coordinador_puede_ver_empleado() logic, unioned for both roles.

### 2.2 Backfill
- fichajes_correcciones.sociedad_id backfilled from empleados.id_sociedad
  where NULL (same backfill the routing migration used; safe to re-run).

### 2.3 Policies on fichajes_correcciones
- select_own_or_admin_correcciones (SELECT): owner; admin/rrhh see all;
  rrhh_gerontalia sees their society (sociedad_id = Gerontalia OR NULL —
  NULL rows belong to no routed society and were previously invisible);
  supervisor/coordinador see their assigned employees' rows (helper above).
  All branches check role OR roles.
- update_own_or_admin_correcciones (UPDATE): same USING/WITH CHECK so the
  people who can see a petition can approve/reject it.
- delete_admin_correcciones (DELETE): admin/rrhh/rrhh_gerontalia, role OR roles.
- insert_own_correcciones (INSERT): unchanged semantics (user_id = auth.uid()).

3. Security
- All helpers derive the caller from auth.uid(); no caller-supplied identity.
- Supervisor/coordinador access stays scoped to their assigned employees/centers.
- Society routing for rrhh vs rrhh_gerontalia is preserved.
- RLS stays enabled; grants on the table are unchanged (already full CRUD for
  authenticated).
- Helpers are SECURITY DEFINER with a pinned search_path so the policy
  subqueries (supervisor_asignaciones, empleados, etc.) evaluate under RLS-
  exempt definer rights without recursion on user_profiles.
*/

-- ── 1. Helpers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_any_role(p_roles text[])
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  SET row_security TO 'off'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.activo = true
      AND (up.role = ANY(p_roles) OR up.roles && p_roles)
  );
$function$;

CREATE OR REPLACE FUNCTION public.puede_ver_empleado(p_empleado_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  SET row_security TO 'off'
AS $function$
  SELECT p_empleado_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.activo = true
      AND (up.role = ANY(ARRAY['supervisor','coordinador']) OR up.roles && ARRAY['supervisor','coordinador']::text[])
      AND (
        EXISTS (
          SELECT 1 FROM public.supervisor_asignaciones sa
          WHERE sa.supervisor_id = up.id
            AND sa.empleado_id = p_empleado_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.supervisor_centros sc
          JOIN public.empleados e ON e.centro_id = sc.centro_id
          WHERE sc.supervisor_id = up.id
            AND e.id = p_empleado_id
        )
        OR (
          (up.role = 'coordinador' OR 'coordinador' = ANY(up.roles))
          AND EXISTS (
            SELECT 1
            FROM public.coordinador_supervisores cs
            JOIN public.supervisor_asignaciones sa ON sa.supervisor_id = cs.supervisor_id
            WHERE cs.coordinador_id = up.id
              AND sa.empleado_id = p_empleado_id
          )
        )
        OR (
          (up.role = 'coordinador' OR 'coordinador' = ANY(up.roles))
          AND EXISTS (
            SELECT 1
            FROM public.coordinador_supervisores cs
            JOIN public.supervisor_centros sc ON sc.supervisor_id = cs.supervisor_id
            JOIN public.empleados e ON e.centro_id = sc.centro_id
            WHERE cs.coordinador_id = up.id
              AND e.id = p_empleado_id
          )
        )
      )
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.has_any_role(text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.puede_ver_empleado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_ver_empleado(uuid) TO authenticated;

-- ── 2. Backfill sociedad_id from empleados ───────────────────────────────────
UPDATE fichajes_correcciones fc
SET sociedad_id = e.id_sociedad
FROM empleados e
WHERE fc.empleado_id = e.id
  AND fc.sociedad_id IS NULL
  AND e.id_sociedad IS NOT NULL;

-- ── 3. Policies ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "select_own_or_admin_correcciones" ON fichajes_correcciones;

CREATE POLICY "select_own_or_admin_correcciones"
ON fichajes_correcciones FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_any_role(ARRAY['admin','rrhh'])
  OR (
    public.has_any_role(ARRAY['rrhh_gerontalia'])
    AND (
      sociedad_id = '6632d8d1-c4e7-4540-aab7-515b9d7913f7'::uuid
      OR sociedad_id IS NULL
    )
  )
  OR public.puede_ver_empleado(empleado_id)
);

DROP POLICY IF EXISTS "update_own_or_admin_correcciones" ON fichajes_correcciones;

CREATE POLICY "update_own_or_admin_correcciones"
ON fichajes_correcciones FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_any_role(ARRAY['admin','rrhh'])
  OR (
    public.has_any_role(ARRAY['rrhh_gerontalia'])
    AND (
      sociedad_id = '6632d8d1-c4e7-4540-aab7-515b9d7913f7'::uuid
      OR sociedad_id IS NULL
    )
  )
  OR public.puede_ver_empleado(empleado_id)
)
WITH CHECK (
  user_id = auth.uid()
  OR public.has_any_role(ARRAY['admin','rrhh'])
  OR (
    public.has_any_role(ARRAY['rrhh_gerontalia'])
    AND (
      sociedad_id = '6632d8d1-c4e7-4540-aab7-515b9d7913f7'::uuid
      OR sociedad_id IS NULL
    )
  )
  OR public.puede_ver_empleado(empleado_id)
);

DROP POLICY IF EXISTS "delete_admin_correcciones" ON fichajes_correcciones;

CREATE POLICY "delete_admin_correcciones"
ON fichajes_correcciones FOR DELETE
TO authenticated
USING (
  public.has_any_role(ARRAY['admin','rrhh'])
  OR public.has_any_role(ARRAY['rrhh_gerontalia'])
);

DROP POLICY IF EXISTS "insert_own_correcciones" ON fichajes_correcciones;

CREATE POLICY "insert_own_correcciones"
ON fichajes_correcciones FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
