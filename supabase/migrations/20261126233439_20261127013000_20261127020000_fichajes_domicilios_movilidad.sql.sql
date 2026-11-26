/*
# Movilidad: registro de domicilios geolocalizados por trabajador

1. Purpose
The jornada flow records entrada/salida at the workplace. When an employee
moves between domiciles during the day (e.g. 8:00 arrives, 8:00-9:00 at a
domicile), those visits are now recorded separately in a new table so the
existing fichajes logic stays untouched. Each visit stores WHERE it happened
(GPS), replacing the old pausa (descanso) buttons in the mobile jornada menu.

2. New table: `fichajes_domicilios`
- `id` uuid PK.
- `empleado_id` uuid NOT NULL -> empleados.id (the worker the visit belongs to).
- `user_id` uuid NOT NULL DEFAULT auth.uid() -> user_profiles.id (who clocked
  it; defaults to the session so an insert that omits it still satisfies RLS).
- `fecha` date NOT NULL DEFAULT current_date (day of the visit).
- `timestamp` timestamptz NOT NULL DEFAULT now() (moment of the clock).
- `tipo_evento` text NOT NULL CHECK in ('inicio_domicilio','fin_domicilio').
- `domicilio_nombre` text (free-text label of the domicile, optional).
- `latitud` / `longitud` numeric (GPS coordinates from the mobile device).
- `ubicacion` text ("lat, lon" string for easy display).
- `dispositivo` text (device description).
- `created_at` timestamptz DEFAULT now().

3. Security
- RLS ENABLED. All policies TO authenticated, caller derived from auth.uid().
- SELECT: own rows (user_id = auth.uid()); admin/rrhh see all;
  rrhh_gerontalia sees Gerontalia society or NULL-society rows;
  supervisor/coordinador see rows of their assigned employees via the
  existing puede_ver_empleado() helper (same visibility as correcciones).
- INSERT: only own rows (user_id = auth.uid()).
- UPDATE: owner only.
- DELETE: admin/rrhh/rrhh_gerontalia only.
- Grants: SELECT, INSERT, UPDATE to authenticated; DELETE only to
  authenticated too (RLS restricts rows); servicio_role untouched.
- puede_ver_empleado and has_any_role EXECUTE already granted to authenticated.

4. Tab permissions
- role_tab_permissions rows for tab 'movilidad' enabled for the same roles
  that have 'fichajes' enabled (rrhh, rrhh_gerontalia, supervisor,
  supervisor_gerontalia, coordinador, administrador_gerontalia). Inserted
  only if the role already has fichajes enabled, so no role gains access
  beyond what it already has.

5. Notes
- Purely additive: no change to fichajes, correcciones or existing policies.
- Indexes on (empleado_id, fecha) and (user_id) for list queries.
*/

-- ── 1. Table ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fichajes_domicilios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT current_date,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  tipo_evento text NOT NULL CHECK (tipo_evento IN ('inicio_domicilio','fin_domicilio')),
  domicilio_nombre text,
  latitud numeric,
  longitud numeric,
  ubicacion text,
  dispositivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fichajes_domicilios_empleado_fecha
  ON public.fichajes_domicilios (empleado_id, fecha DESC, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_fichajes_domicilios_user
  ON public.fichajes_domicilios (user_id, fecha DESC);

ALTER TABLE public.fichajes_domicilios ENABLE ROW LEVEL SECURITY;

-- ── 2. Policies ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "select_domicilios_visible" ON public.fichajes_domicilios;
CREATE POLICY "select_domicilios_visible"
ON public.fichajes_domicilios FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_any_role(ARRAY['admin','rrhh'])
  OR (
    public.has_any_role(ARRAY['rrhh_gerontalia'])
    AND (
      EXISTS (
        SELECT 1 FROM public.empleados e
        WHERE e.id = fichajes_domicilios.empleado_id
          AND (
            e.id_sociedad = '6632d8d1-c4e7-4540-aab7-515b9d7913f7'::uuid
            OR e.id_sociedad IS NULL
          )
      )
    )
  )
  OR public.puede_ver_empleado(empleado_id)
);

DROP POLICY IF EXISTS "insert_own_domicilios" ON public.fichajes_domicilios;
CREATE POLICY "insert_own_domicilios"
ON public.fichajes_domicilios FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_domicilios" ON public.fichajes_domicilios;
CREATE POLICY "update_own_domicilios"
ON public.fichajes_domicilios FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_admin_domicilios" ON public.fichajes_domicilios;
CREATE POLICY "delete_admin_domicilios"
ON public.fichajes_domicilios FOR DELETE
TO authenticated
USING (
  public.has_any_role(ARRAY['admin','rrhh'])
  OR public.has_any_role(ARRAY['rrhh_gerontalia'])
);

-- ── 3. Grants ────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fichajes_domicilios TO authenticated;

-- ── 4. Tab permission rows for the Movilidad tab ─────────────────────────────
INSERT INTO role_tab_permissions (role, tab_id, enabled)
SELECT r.role, 'movilidad', true
FROM role_tab_permissions r
WHERE r.tab_id = 'fichajes'
  AND r.enabled = true
  AND NOT EXISTS (
    SELECT 1 FROM role_tab_permissions x
    WHERE x.role = r.role AND x.tab_id = 'movilidad'
  );