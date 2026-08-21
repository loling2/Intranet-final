/*
# Fix COALESCE type mismatch in staff_upload_device_delivery_doc

## Problem
The function `staff_upload_device_delivery_doc` used `COALESCE(v_device.society_id, v_employee.id_sociedad, '')`
where `v_device.society_id` is `text` but `v_employee.id_sociedad` is `uuid`.
PostgreSQL cannot match text and uuid types in COALESCE, causing:
"COALESCE types text and uuid cannot be matched"

## Fix
Cast `v_employee.id_sociedad` to `text` so all COALESCE arguments are text,
matching the `society_id` column type in `employee_documents`.

## Security
No RLS or policy changes. The function remains SECURITY DEFINER with search_path 'public'.
*/

CREATE OR REPLACE FUNCTION public.staff_upload_device_delivery_doc(
  p_dispositivo_id uuid,
  p_storage_path text,
  p_nombre text,
  p_mime_type text,
  p_size_bytes bigint,
  p_subido_por_nombre text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_device RECORD;
  v_employee RECORD;
  v_doc_id uuid;
BEGIN
  -- Verify caller is staff
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('admin','rrhh','prevencion','supervisor','encargado','administracion')
  ) THEN
    RAISE EXCEPTION 'Permiso denegado';
  END IF;

  -- Fetch the device
  SELECT * INTO v_device FROM dispositivos WHERE id = p_dispositivo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispositivo no encontrado';
  END IF;

  -- Find the assigned employee with a user_id
  SELECT e.id, e.user_id, e.nombre, e.id_sociedad INTO v_employee
  FROM empleados e
  WHERE e.id = v_device.empleado_id
  AND e.user_id IS NOT NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El dispositivo no tiene un empleado asignado con cuenta de acceso';
  END IF;

  -- Insert the document into employee_documents
  -- Cast id_sociedad (uuid) to text so COALESCE types match society_id (text)
  INSERT INTO employee_documents (
    employee_id, society_id, folder, nombre, storage_path,
    mime_type, size_bytes, subido_por, subido_por_nombre
  ) VALUES (
    v_employee.user_id,
    COALESCE(v_device.society_id, v_employee.id_sociedad::text, ''),
    'publica', p_nombre, p_storage_path,
    p_mime_type, p_size_bytes, auth.uid(), p_subido_por_nombre
  )
  RETURNING id INTO v_doc_id;

  -- Resolve the open pending doc for this device
  UPDATE employee_pending_docs
  SET completed_at = now()
  WHERE ref_id = p_dispositivo_id::text
  AND tipo = 'entrega_dispositivo'
  AND completed_at IS NULL;

  RETURN v_doc_id;
END;
$function$;
