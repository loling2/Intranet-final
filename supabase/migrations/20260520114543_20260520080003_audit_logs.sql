/*
  # Audit Log System

  1. New Tables
    - `audit_logs`
      - `id` (uuid, PK)
      - `evento` (text, event type key)
      - `descripcion` (text, human-readable summary)
      - `autor_id` (uuid, who triggered the event)
      - `autor_nombre` (text, snapshot)
      - `autor_email` (text, snapshot)
      - `entidad` (text, entity type: 'user', 'vehicle', 'document', etc.)
      - `entidad_id` (text, nullable, ID of the affected entity)
      - `metadata` (jsonb, additional context)
      - `society_id` (text, nullable)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled
    - Only admins and RRHH can read audit logs
    - Any authenticated user can insert (the app controls what gets logged)

  3. Event Types
    - user_invited, user_role_changed, user_activated, user_deactivated
    - password_reset
    - vehicle_checkin, vehicle_checkout, vehicle_forced_release
    - document_uploaded, document_deleted
*/

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento text NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nombre text NOT NULL DEFAULT '',
  autor_email text NOT NULL DEFAULT '',
  entidad text NOT NULL DEFAULT '',
  entidad_id text,
  metadata jsonb DEFAULT '{}',
  society_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY "RRHH can read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'rrhh'
    )
  );

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (autor_id = auth.uid());

CREATE INDEX IF NOT EXISTS audit_logs_evento_idx ON audit_logs(evento);
CREATE INDEX IF NOT EXISTS audit_logs_autor_idx ON audit_logs(autor_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_society_idx ON audit_logs(society_id);
