/*
# Employee Pending Documents

## Purpose
When a supervisor assigns a device to an employee, the employee should see a
"pending document" in their "Mis Documentos" section — e.g. "Entrega de
dispositivo: Lenovo ThinkPad" — so they know they need to upload the signed
delivery receipt (PDF or photo). Once uploaded, the pending disappears and
the file shows up as a regular employee document.

## New Tables
### employee_pending_docs
- `id` - UUID PK
- `employee_id` - UUID, references auth.users (the employee who must upload)
- `society_id` - text, which society
- `tipo` - text, category of pending doc (e.g. 'entrega_dispositivo')
- `titulo` - text, human-readable label (e.g. "Entrega de dispositivo: Lenovo ThinkPad")
- `descripcion` - text, optional longer description
- `ref_id` - text, optional reference to the source record (e.g. dispositivo id)
- `created_at` - timestamptz
- `completed_at` - timestamptz, null while pending, set when employee uploads

## New Function: employee_upload_pending_doc (SECURITY DEFINER)
Allows an authenticated employee to upload a file that resolves one of their
own pending docs. The function:
1. Validates the pending doc belongs to the caller.
2. Inserts a row in employee_documents (folder 'publica').
3. Marks the pending doc as completed.
All in one atomic operation so the employee can't insert documents for
others or resolve pendings that aren't theirs.

## RLS
- employee_pending_docs: employees see their own pending (incomplete) docs;
  admin/rrhh/supervisor can see all.
- employee_documents: the existing INSERT policy only allows admin/rrhh.
  The SECURITY DEFINER function bypasses RLS, so the employee upload works
  through the function without needing a direct INSERT grant.
*/

-- ─────────────────────────────────────────────────────────────
-- employee_pending_docs table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_pending_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  society_id text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT '',
  titulo text NOT NULL DEFAULT '',
  descripcion text NOT NULL DEFAULT '',
  ref_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE employee_pending_docs ENABLE ROW LEVEL SECURITY;

-- Employees see their own pending (not-yet-completed) docs
DROP POLICY IF EXISTS "Employees view own pending docs" ON employee_pending_docs;
CREATE POLICY "Employees view own pending docs"
  ON employee_pending_docs FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid()
    AND completed_at IS NULL
  );

-- Admin/RRHH/supervisor/prevencion can see all pending docs
DROP POLICY IF EXISTS "Staff view all pending docs" ON employee_pending_docs;
CREATE POLICY "Staff view all pending docs"
  ON employee_pending_docs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin','rrhh','supervisor','prevencion','encargado','administracion')
    )
  );

-- Admin/RRHH/supervisor can insert pending docs (when assigning devices)
DROP POLICY IF EXISTS "Staff insert pending docs" ON employee_pending_docs;
CREATE POLICY "Staff insert pending docs"
  ON employee_pending_docs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin','rrhh','supervisor','prevencion','encargado','administracion')
    )
  );

-- Admin/RRHH/supervisor can update pending docs (e.g. mark completed, or cancel)
DROP POLICY IF EXISTS "Staff update pending docs" ON employee_pending_docs;
CREATE POLICY "Staff update pending docs"
  ON employee_pending_docs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin','rrhh','supervisor','prevencion','encargado','administracion')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin','rrhh','supervisor','prevencion','encargado','administracion')
    )
  );

-- Admin/RRHH/supervisor can delete pending docs
DROP POLICY IF EXISTS "Staff delete pending docs" ON employee_pending_docs;
CREATE POLICY "Staff delete pending docs"
  ON employee_pending_docs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin','rrhh','supervisor','prevencion','encargado','administracion')
    )
  );

CREATE INDEX IF NOT EXISTS idx_pending_docs_employee ON employee_pending_docs (employee_id);
CREATE INDEX IF NOT EXISTS idx_pending_docs_completed ON employee_pending_docs (completed_at);

-- ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER function: employee_upload_pending_doc
-- ─────────────────────────────────────────────────────────────
-- Allows an employee to upload a file that resolves one of their pending docs.
-- Inserts into employee_documents and marks the pending as completed.
CREATE OR REPLACE FUNCTION employee_upload_pending_doc(
  p_pending_id uuid,
  p_storage_path text,
  p_nombre text,
  p_mime_type text,
  p_size_bytes bigint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending employee_pending_docs%ROWTYPE;
  v_doc_id uuid;
BEGIN
  -- Fetch the pending doc and verify ownership
  SELECT * INTO v_pending
  FROM employee_pending_docs
  WHERE id = p_pending_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento pendiente no encontrado';
  END IF;

  IF v_pending.employee_id != auth.uid() THEN
    RAISE EXCEPTION 'No tienes permiso para subir este documento';
  END IF;

  IF v_pending.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este documento ya ha sido subido';
  END IF;

  -- Insert into employee_documents
  INSERT INTO employee_documents (
    employee_id, society_id, folder, nombre, storage_path,
    mime_type, size_bytes, subido_por, subido_por_nombre
  )
  VALUES (
    v_pending.employee_id, v_pending.society_id, 'publica', p_nombre,
    p_storage_path, p_mime_type, p_size_bytes, auth.uid(), ''
  )
  RETURNING id INTO v_doc_id;

  -- Mark pending as completed
  UPDATE employee_pending_docs
  SET completed_at = now()
  WHERE id = p_pending_id;

  RETURN v_doc_id;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION employee_upload_pending_doc TO authenticated;
