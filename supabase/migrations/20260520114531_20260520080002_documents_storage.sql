/*
  # Document Management System

  1. New Tables
    - `documents`
      - `id` (uuid, PK)
      - `nombre_archivo` (text)
      - `tipo` (text, MIME type or extension)
      - `usuario_destino_id` (uuid, FK to auth.users, nullable)
      - `usuario_destino_email` (text, snapshot)
      - `society_id` (text)
      - `fecha_subida` (timestamptz)
      - `subido_por` (uuid, FK to auth.users)
      - `subido_por_nombre` (text, snapshot)
      - `tamano_bytes` (bigint)
      - `indexeddb_key` (text, the key used to retrieve blob from IndexedDB)
      - `created_at`

  2. Security
    - RLS enabled
    - Admins/RRHH can see all documents
    - Users can only see documents assigned to them

  3. Notes
    - Actual file blobs are stored in IndexedDB on the client
    - This table stores metadata and the IndexedDB key to retrieve the blob
*/

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_archivo text NOT NULL,
  tipo text NOT NULL DEFAULT '',
  usuario_destino_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_destino_email text NOT NULL DEFAULT '',
  society_id text NOT NULL DEFAULT '',
  fecha_subida timestamptz NOT NULL DEFAULT now(),
  subido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subido_por_nombre text NOT NULL DEFAULT '',
  tamano_bytes bigint NOT NULL DEFAULT 0,
  indexeddb_key text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all documents"
  ON documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY "RRHH can read all documents"
  ON documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'rrhh'
    )
  );

CREATE POLICY "Users can read own documents"
  ON documents FOR SELECT
  TO authenticated
  USING (usuario_destino_id = auth.uid());

CREATE POLICY "Admins and RRHH can insert documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'rrhh')
    )
  );

CREATE POLICY "Admins can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY "RRHH can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'rrhh'
    )
  );

CREATE INDEX IF NOT EXISTS documents_usuario_destino_idx ON documents(usuario_destino_id);
CREATE INDEX IF NOT EXISTS documents_society_idx ON documents(society_id);
CREATE INDEX IF NOT EXISTS documents_fecha_subida_idx ON documents(fecha_subida DESC);
