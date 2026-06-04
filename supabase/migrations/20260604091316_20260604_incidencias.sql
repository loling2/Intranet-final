/*
  # Incidencias (Incidents) Module

  ## Summary
  Creates a complete incident tracking system where employees can submit incidents
  and designated recipients (e.g., "Informatica") can manage them through workflow states.

  ## New Tables

  ### `incidencias`
  Main incidents table.
  - `id` - UUID primary key
  - `numero` - Auto-incremented incident number (INC-0001 format)
  - `titulo` - Short title / name of the incident
  - `descripcion` - Full description
  - `estado` - Workflow state: 'pendiente' | 'en_proceso' | 'finalizada'
  - `foto_url` - Optional URL/path to attached photo
  - `creado_por_id` - user_profiles.id of the employee who created it
  - `creado_por_nombre` - Snapshot of creator's name
  - `destinatario_id` - user_profiles.id of the recipient (e.g., Julio / Informatica)
  - `destinatario_nombre` - Snapshot of recipient's name
  - `fecha_creacion` - When the incident was created
  - `fecha_finalizacion` - When it was moved to 'finalizada'
  - `society_id` - Optional society context

  ### `incidencias_mensajes`
  Chronological message thread on each incident (status changes + comments).
  - `id` - UUID primary key
  - `incidencia_id` - FK to incidencias
  - `autor_id` - user_profiles.id of message author
  - `autor_nombre` - Snapshot of author's name
  - `texto` - Message content
  - `estado_nuevo` - If this message changed the state, record the new state
  - `created_at` - Timestamp

  ## Security
  - RLS enabled on both tables
  - Employees can only see incidents they created OR are assigned as recipient
  - Only admin/rrhh can see all incidents
  - Message insert allowed for creator and recipient of the incident
*/

-- ─── Incidencias ────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS incidencias_numero_seq START 1;

CREATE TABLE IF NOT EXISTS incidencias (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero         int NOT NULL DEFAULT nextval('incidencias_numero_seq'),
  titulo         text NOT NULL,
  descripcion    text NOT NULL DEFAULT '',
  estado         text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'finalizada')),
  foto_url       text,
  creado_por_id  uuid NOT NULL,
  creado_por_nombre text NOT NULL DEFAULT '',
  destinatario_id   uuid NOT NULL,
  destinatario_nombre text NOT NULL DEFAULT '',
  fecha_creacion   timestamptz NOT NULL DEFAULT now(),
  fecha_finalizacion timestamptz,
  society_id     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE incidencias ENABLE ROW LEVEL SECURITY;

-- Employees can see their own created incidents or incidents assigned to them
CREATE POLICY "Incidencia creator or recipient can select"
  ON incidencias FOR SELECT
  TO authenticated
  USING (
    auth.uid() = creado_por_id
    OR auth.uid() = destinatario_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh', 'supervisor')
    )
  );

-- Authenticated users can create incidents
CREATE POLICY "Authenticated users can create incidencias"
  ON incidencias FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creado_por_id);

-- Recipient or admin can update state
CREATE POLICY "Recipient or admin can update incidencias"
  ON incidencias FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = destinatario_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  )
  WITH CHECK (
    auth.uid() = destinatario_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

-- ─── Incidencias Mensajes ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS incidencias_mensajes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incidencia_id   uuid NOT NULL REFERENCES incidencias(id) ON DELETE CASCADE,
  autor_id        uuid NOT NULL,
  autor_nombre    text NOT NULL DEFAULT '',
  texto           text NOT NULL,
  estado_nuevo    text CHECK (estado_nuevo IN ('pendiente', 'en_proceso', 'finalizada', NULL)),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE incidencias_mensajes ENABLE ROW LEVEL SECURITY;

-- Message visible to incident participants
CREATE POLICY "Participants can view messages"
  ON incidencias_mensajes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM incidencias i
      WHERE i.id = incidencia_id
        AND (
          i.creado_por_id = auth.uid()
          OR i.destinatario_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role IN ('admin', 'rrhh', 'supervisor')
          )
        )
    )
  );

-- Participants can post messages
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
          OR i.destinatario_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role IN ('admin', 'rrhh')
          )
        )
    )
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_incidencias_creado_por ON incidencias(creado_por_id);
CREATE INDEX IF NOT EXISTS idx_incidencias_destinatario ON incidencias(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_incidencias_estado ON incidencias(estado);
CREATE INDEX IF NOT EXISTS idx_incidencias_mensajes_incidencia ON incidencias_mensajes(incidencia_id);
