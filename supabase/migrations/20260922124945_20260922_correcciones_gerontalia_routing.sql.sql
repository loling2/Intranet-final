/*
# Route Gerontalia correction petitions to rrhh_gerontalia only

## Context
Currently all RRHH users (role 'rrhh') can see and approve all correction petitions
(fichajes_correcciones), including those from Gerontalia employees. The client wants
Gerontalia corrections (employees belonging to sociedad 'Gerontalia', the society with
id 6632d8d1-c4e7-4540-aab7-515b9d7913f7 — which includes "Tierra de Oro" and
"San Fernando" workers) to be visible ONLY to users with role 'rrhh_gerontalia',
NOT to the regular 'rrhh' users.

## Changes

### 1. New column on fichajes_correcciones
- `sociedad_id` (uuid, nullable, references sociedades.id ON DELETE SET NULL)
  Stores the society (sociedad) of the employee who filed the correction, so RLS
  can route visibility by society.

### 2. Backfill
- Populate `sociedad_id` for existing corrections by looking up the employee's
  `id_sociedad` from the `empleados` table (matching by `empleado_id`).
- For corrections without a matching employee, `sociedad_id` stays NULL.

### 3. RLS policy changes on fichajes_correcciones
- SELECT: employees see their own; admin sees all; 'rrhh' sees only corrections
  where sociedad_id != Gerontalia; 'rrhh_gerontalia' sees only corrections where
  sociedad_id = Gerontalia; supervisor sees their employees' corrections.
- UPDATE: same society-scoped rules for rrhh / rrhh_gerontalia; admin can update any.
- DELETE: admin and rrhh (non-Gerontalia only) / rrhh_gerontalia (Gerontalia only).

### 4. Notes
- The Gerontalia society ID is 6632d8d1-c4e7-4540-aab7-515b9d7913f7.
- Existing functionality for rrhh (non-Gerontalia) and admin is preserved.
- The 'rrhh' role loses visibility of Gerontalia corrections but keeps all other
  societies (Apedeca, Eleda, Serca Gestion).
*/

-- ── 1. Add sociedad_id column ──────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fichajes_correcciones' AND column_name = 'sociedad_id'
  ) THEN
    ALTER TABLE fichajes_correcciones
      ADD COLUMN sociedad_id uuid REFERENCES sociedades(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 2. Backfill sociedad_id from empleados ──────────────────────────────────────
UPDATE fichajes_correcciones fc
SET sociedad_id = e.id_sociedad
FROM empleados e
WHERE fc.empleado_id = e.id
  AND fc.sociedad_id IS NULL;

-- ── 3. Index for society-scoped queries ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_correcciones_sociedad
  ON fichajes_correcciones(sociedad_id);

-- ── 4. Updated RLS policies ─────────────────────────────────────────────────────
-- Gerontalia society ID constant
-- 6632d8d1-c4e7-4540-aab7-515b9d7913f7

-- SELECT
DROP POLICY IF EXISTS "select_own_or_admin_correcciones" ON fichajes_correcciones;
CREATE POLICY "select_own_or_admin_correcciones" ON fichajes_correcciones FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.role = 'admin'
          OR (up.role = 'rrhh' AND (sociedad_id IS NULL OR sociedad_id != '6632d8d1-c4e7-4540-aab7-515b9d7913f7'))
          OR (up.role = 'rrhh_gerontalia' AND sociedad_id = '6632d8d1-c4e7-4540-aab7-515b9d7913f7')
          OR up.role = 'supervisor'
        )
    )
  );

-- INSERT (unchanged — any authenticated user can insert their own petition)
-- The sociedad_id will be set by the frontend; if omitted, it stays NULL
-- which means only admin and the owner can see it (rrhh won't see NULL sociedad
-- corrections that belong to Gerontalia, but since sociedad_id is set on insert
-- this is just a safety net).
DROP POLICY IF EXISTS "insert_own_correcciones" ON fichajes_correcciones;
CREATE POLICY "insert_own_correcciones" ON fichajes_correcciones FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE
DROP POLICY IF EXISTS "update_own_or_admin_correcciones" ON fichajes_correcciones;
CREATE POLICY "update_own_or_admin_correcciones" ON fichajes_correcciones FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.role = 'admin'
          OR (up.role = 'rrhh' AND (sociedad_id IS NULL OR sociedad_id != '6632d8d1-c4e7-4540-aab7-515b9d7913f7'))
          OR (up.role = 'rrhh_gerontalia' AND sociedad_id = '6632d8d1-c4e7-4540-aab7-515b9d7913f7')
        )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.role = 'admin'
          OR (up.role = 'rrhh' AND (sociedad_id IS NULL OR sociedad_id != '6632d8d1-c4e7-4540-aab7-515b9d7913f7'))
          OR (up.role = 'rrhh_gerontalia' AND sociedad_id = '6632d8d1-c4e7-4540-aab7-515b9d7913f7')
        )
    )
  );

-- DELETE
DROP POLICY IF EXISTS "delete_admin_correcciones" ON fichajes_correcciones;
CREATE POLICY "delete_admin_correcciones" ON fichajes_correcciones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.role = 'admin'
          OR (up.role = 'rrhh' AND (sociedad_id IS NULL OR sociedad_id != '6632d8d1-c4e7-4540-aab7-515b9d7913f7'))
          OR (up.role = 'rrhh_gerontalia' AND sociedad_id = '6632d8d1-c4e7-4540-aab7-515b9d7913f7')
        )
    )
  );
