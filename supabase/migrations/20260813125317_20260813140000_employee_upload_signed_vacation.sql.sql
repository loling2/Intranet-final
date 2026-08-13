-- ─────────────────────────────────────────────────────────────
-- Allow employees to upload their own signed vacation documents
-- and register them in employee_documents.
--
-- RLS blocks employees from directly inserting into employee_documents
-- and from updating vacation_requests. A SECURITY DEFINER function
-- owned by postgres bypasses RLS safely with explicit ownership checks.
-- ─────────────────────────────────────────────────────────────

-- Add columns for employee-uploaded signed letters (if not already present)
ALTER TABLE vacation_requests
  ADD COLUMN IF NOT EXISTS carta_firmada_path text,
  ADD COLUMN IF NOT EXISTS carta_firmada_at timestamptz,
  ADD COLUMN IF NOT EXISTS carta_firmada_por_nombre text;

-- ─────────────────────────────────────────────────────────────
-- Function: employee_upload_signed_vacation
--
-- Called by an authenticated employee. Validates that the vacation
-- request belongs to the caller, then:
--   1. Updates vacation_requests.carta_firmada_path / _at / _por_nombre
--   2. Inserts a row into employee_documents (folder = 'publica')
--      so the document appears in "Mis Documentos".
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION employee_upload_signed_vacation(
  p_request_id uuid,
  p_storage_path text,
  p_nombre text,
  p_mime_type text DEFAULT 'application/pdf',
  p_size_bytes bigint DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request vacation_requests%ROWTYPE;
  v_doc_id uuid;
  v_profile_name text;
BEGIN
  -- Load the request and verify ownership
  SELECT * INTO v_request
    FROM vacation_requests
    WHERE id = p_request_id;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;

  IF v_request.employee_id != auth.uid() THEN
    RAISE EXCEPTION 'No tienes permiso para subir un documento a esta solicitud';
  END IF;

  IF v_request.estado != 'aprobada' OR v_request.documento_path IS NULL THEN
    RAISE EXCEPTION 'Solo puedes subir documentos a solicitudes aprobadas';
  END IF;

  -- Get the user's display name
  SELECT nombre INTO v_profile_name
    FROM user_profiles
    WHERE id = auth.uid();

  -- 1. Update vacation_requests
  UPDATE vacation_requests
    SET carta_firmada_path = p_storage_path,
        carta_firmada_at = now(),
        carta_firmada_por_nombre = COALESCE(v_profile_name, ''),
        updated_at = now()
    WHERE id = p_request_id;

  -- 2. Insert into employee_documents (publica folder so employee can see it)
  INSERT INTO employee_documents (
    employee_id, society_id, folder, nombre, storage_path,
    mime_type, size_bytes, subido_por, subido_por_nombre
  )
  VALUES (
    v_request.employee_id,
    v_request.society_id,
    'publica',
    p_nombre,
    p_storage_path,
    p_mime_type,
    p_size_bytes,
    auth.uid(),
    COALESCE(v_profile_name, '')
  )
  RETURNING id INTO v_doc_id;

  RETURN v_doc_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION employee_upload_signed_vacation TO authenticated;

-- Also allow employees to SELECT their own employee_documents rows
-- regardless of folder (so they can see their uploaded signed vacations)
-- The existing policy only allows folder = 'publica'; we add one for all folders
-- owned by the user.
CREATE POLICY "Employees view own all docs"
  ON employee_documents FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- Allow employees to update their own vacation_requests row
-- but only the carta_firmada_* columns (the function handles the actual update,
-- but employees need UPDATE policy for the function to work under RLS)
-- Actually, SECURITY DEFINER bypasses RLS, so no additional policy needed.
