/*
  # Departamentos (Departments) module + Incidencias schema update

  ## Summary
  Introduces a department system so incidents can be routed to a department
  (e.g. "Informatica") rather than a specific individual. All members of that
  department will see the incident.

  ## New Tables

  ### `departamentos`
  - `id` uuid PK
  - `nombre` text - Department name
  - `descripcion` text - Optional description
  - `created_at` timestamptz

  ### `departamento_miembros`
  - `id` uuid PK
  - `departamento_id` uuid FK -> departamentos
  - `user_id` uuid - user_profiles.id of the member
  - `user_nombre` text - Snapshot of the member's name
  - `created_at` timestamptz

  ## Modified Tables

  ### `incidencias`
  - Added `departamento_id` uuid nullable FK -> departamentos
  - Added `departamento_nombre` text (snapshot)
  - `destinatario_id` is now nullable (kept for legacy, unused going forward)

  ## Security Changes
  - RLS on incidencias updated: SELECT/UPDATE now checks department membership
  - RLS on incidencias_mensajes updated to match new department membership check
  - departamentos: authenticated users can read; only admin/rrhh can write
  - departamento_miembros: authenticated users can read; only admin/rrhh can write
*/

-- ─── Departamentos ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS departamentos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE departamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view departamentos"
  ON departamentos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and rrhh can insert departamentos"
  ON departamentos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

CREATE POLICY "Admin and rrhh can update departamentos"
  ON departamentos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

CREATE POLICY "Admin and rrhh can delete departamentos"
  ON departamentos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

-- ─── Departamento Miembros ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS departamento_miembros (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  departamento_id  uuid NOT NULL REFERENCES departamentos(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL,
  user_nombre      text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (departamento_id, user_id)
);

ALTER TABLE departamento_miembros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view departamento_miembros"
  ON departamento_miembros FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and rrhh can insert departamento_miembros"
  ON departamento_miembros FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

CREATE POLICY "Admin and rrhh can delete departamento_miembros"
  ON departamento_miembros FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dept_miembros_dept ON departamento_miembros(departamento_id);
CREATE INDEX IF NOT EXISTS idx_dept_miembros_user ON departamento_miembros(user_id);

-- ─── Alter incidencias ───────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidencias' AND column_name = 'departamento_id'
  ) THEN
    ALTER TABLE incidencias ADD COLUMN departamento_id uuid REFERENCES departamentos(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidencias' AND column_name = 'departamento_nombre'
  ) THEN
    ALTER TABLE incidencias ADD COLUMN departamento_nombre text NOT NULL DEFAULT '';
  END IF;

  -- Make destinatario_id nullable (previously NOT NULL, now optional)
  ALTER TABLE incidencias ALTER COLUMN destinatario_id DROP NOT NULL;
END $$;

-- ─── Update RLS on incidencias ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Incidencia creator or recipient can select" ON incidencias;
DROP POLICY IF EXISTS "Recipient or admin can update incidencias" ON incidencias;

CREATE POLICY "Incidencia participants can select"
  ON incidencias FOR SELECT
  TO authenticated
  USING (
    auth.uid() = creado_por_id
    OR EXISTS (
      SELECT 1 FROM departamento_miembros dm
      WHERE dm.departamento_id = incidencias.departamento_id
        AND dm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh', 'supervisor')
    )
  );

CREATE POLICY "Department member or admin can update incidencias"
  ON incidencias FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM departamento_miembros dm
      WHERE dm.departamento_id = incidencias.departamento_id
        AND dm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM departamento_miembros dm
      WHERE dm.departamento_id = incidencias.departamento_id
        AND dm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

-- ─── Update RLS on incidencias_mensajes ─────────────────────────────────────

DROP POLICY IF EXISTS "Participants can view messages" ON incidencias_mensajes;
DROP POLICY IF EXISTS "Participants can insert messages" ON incidencias_mensajes;

CREATE POLICY "Participants can view messages"
  ON incidencias_mensajes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM incidencias i
      WHERE i.id = incidencia_id
        AND (
          i.creado_por_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM departamento_miembros dm
            WHERE dm.departamento_id = i.departamento_id
              AND dm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role IN ('admin', 'rrhh', 'supervisor')
          )
        )
    )
  );

CREATE POLICY "Participants can insert messages"
  ON incidencias_mensajes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = autor_id
    AND EXISTS (
      SELECT 1 FROM incidencias i
      WHERE i.id = incidencia_id
        AND (
          i.creado_por_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM departamento_miembros dm
            WHERE dm.departamento_id = i.departamento_id
              AND dm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role IN ('admin', 'rrhh')
          )
        )
    )
  );
