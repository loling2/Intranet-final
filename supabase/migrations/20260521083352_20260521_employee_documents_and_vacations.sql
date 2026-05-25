/*
  # Employee Documents (RBAC) and Vacation Requests

  ## New Tables

  ### employee_documents
  Stores documents attached to individual employees with folder-level access control.
  - `id` - UUID primary key
  - `employee_id` - references auth.users (the employee)
  - `society_id` - which society
  - `folder` - 'publica' (employee + rrhh/admin) or 'privada' (rrhh/admin only)
  - `nombre` - display name
  - `storage_path` - path in Wasabi/storage
  - `mime_type` - file type
  - `size_bytes` - file size
  - `subido_por` - uploader user id
  - `subido_por_nombre` - uploader display name
  - `created_at` - timestamp

  ### vacation_requests
  Persistent vacation requests replacing mock data.
  - `id` - UUID primary key
  - `employee_id` - references auth.users
  - `employee_nombre` - display name
  - `society_id` - which society
  - `fecha_inicio` - start date (YYYY-MM-DD)
  - `fecha_fin` - end date (YYYY-MM-DD)
  - `dias` - number of days
  - `motivo` - reason text
  - `estado` - 'pendiente' | 'aprobada' | 'denegada'
  - `comentario_rrhh` - denial reason or approval note
  - `revisado_por` - reviewer user id
  - `revisado_por_nombre` - reviewer display name
  - `documento_path` - path in storage for approved vacation letter PDF
  - `created_at` / `updated_at` - timestamps

  ## Security
  - RLS enabled on both tables
  - Employees can see their own documents (public folder only for direct reads)
  - Admin/RRHH can see all documents in both folders
  - Employees can create vacation requests and view their own
  - Admin/RRHH can view and update all vacation requests
*/

-- ─────────────────────────────────────────────────────────────
-- employee_documents
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  society_id text NOT NULL,
  folder text NOT NULL DEFAULT 'publica' CHECK (folder IN ('publica', 'privada')),
  nombre text NOT NULL DEFAULT '',
  storage_path text NOT NULL DEFAULT '',
  mime_type text NOT NULL DEFAULT '',
  size_bytes bigint NOT NULL DEFAULT 0,
  subido_por uuid REFERENCES auth.users(id),
  subido_por_nombre text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;

-- Employees can see their own public documents
CREATE POLICY "Employees view own public docs"
  ON employee_documents FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid()
    AND folder = 'publica'
  );

-- Admin/RRHH (role stored in user_profiles) can see all documents
CREATE POLICY "Admin RRHH view all docs"
  ON employee_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

-- Admin/RRHH can insert
CREATE POLICY "Admin RRHH insert docs"
  ON employee_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

-- Admin/RRHH can update
CREATE POLICY "Admin RRHH update docs"
  ON employee_documents FOR UPDATE
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

-- Admin/RRHH can delete
CREATE POLICY "Admin RRHH delete docs"
  ON employee_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- vacation_requests
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vacation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_nombre text NOT NULL DEFAULT '',
  society_id text NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  dias integer NOT NULL DEFAULT 0,
  motivo text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'denegada')),
  comentario_rrhh text,
  revisado_por uuid REFERENCES auth.users(id),
  revisado_por_nombre text,
  documento_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vacation_requests ENABLE ROW LEVEL SECURITY;

-- Employees can see their own requests
CREATE POLICY "Employees view own vacation requests"
  ON vacation_requests FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- Admin/RRHH can see all requests
CREATE POLICY "Admin RRHH view all vacation requests"
  ON vacation_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

-- Employees can submit their own requests
CREATE POLICY "Employees insert own vacation requests"
  ON vacation_requests FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- Admin/RRHH can update (approve/deny) any request
CREATE POLICY "Admin RRHH update vacation requests"
  ON vacation_requests FOR UPDATE
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

-- Employees can delete their own pending requests
CREATE POLICY "Employees delete own pending requests"
  ON vacation_requests FOR DELETE
  TO authenticated
  USING (employee_id = auth.uid() AND estado = 'pendiente');

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_vacation_requests_society ON vacation_requests (society_id);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_employee ON vacation_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_estado ON vacation_requests (estado);
CREATE INDEX IF NOT EXISTS idx_employee_docs_employee ON employee_documents (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_docs_society ON employee_documents (society_id);
