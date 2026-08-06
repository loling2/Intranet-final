/*
# Device registration requests with approval workflow

## Description
Implements a request/approval flow for device registration:
1. Device submits a registration request with a 6-char request_code + site name + device info
2. Admin/RRHH sees pending requests in the panel, approves them (generates a 6-char approval_code)
3. Device enters the approval_code to complete registration → inserts into kiosk_devices
4. Existing employees default to fichaje_mode = 'kiosk_only'

## New table: device_registration_requests
- id (uuid PK)
- request_code (6-char alphanumeric, unique) — shown on device, visible to admin
- approval_code (6-char alphanumeric, nullable) — generated on approval, entered by device to confirm
- device_key (text) — auto-generated unique device key
- site_name (text) — name of the center/site
- device_info (text) — browser/OS info
- user_agent (text) — raw UA string
- status (text) — 'pending' | 'approved' | 'rejected' | 'completed'
- created_at, reviewed_at, completed_at (timestamptz)
- reviewed_by (uuid, nullable) — admin user_id

## Functions
- submit_device_request(p_site_name, p_device_info, p_user_agent) → returns request_code + device_key
- approve_device_request(p_request_id) → sets status='approved', generates approval_code, returns it
- complete_device_request(p_request_code, p_approval_code) → validates, inserts into kiosk_devices, sets status='completed'

## Other changes
- Set all existing empleados.fichaje_mode = 'kiosk_only' where currently 'any'
- Ensure default stays 'kiosk_only'
*/

-- ── 1. Table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS device_registration_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code    text NOT NULL UNIQUE,
  approval_code   text,
  device_key      text NOT NULL,
  site_name       text NOT NULL,
  device_info     text NOT NULL DEFAULT '',
  user_agent      text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid,
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dev_requests_status ON device_registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_dev_requests_code ON device_registration_requests(request_code);

ALTER TABLE device_registration_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev_requests_select" ON device_registration_requests;
CREATE POLICY "dev_requests_select" ON device_registration_requests
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "dev_requests_insert" ON device_registration_requests;
CREATE POLICY "dev_requests_insert" ON device_registration_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "dev_requests_update" ON device_registration_requests;
CREATE POLICY "dev_requests_update" ON device_registration_requests
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_requests_delete" ON device_registration_requests;
CREATE POLICY "dev_requests_delete" ON device_registration_requests
  FOR DELETE TO authenticated USING (true);

-- ── 2. Helper: generate 6-char alphanumeric code ──────────────────────────

CREATE OR REPLACE FUNCTION public.generate_device_code()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT upper(string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
      1 + floor(random() * 32)::int, 1), ''))
  FROM generate_series(1, 6);
$$;
GRANT EXECUTE ON FUNCTION public.generate_device_code() TO anon, authenticated;

-- ── 3. submit_device_request ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submit_device_request(
  p_site_name   text,
  p_device_info text DEFAULT '',
  p_user_agent  text DEFAULT ''
)
RETURNS TABLE (request_code text, device_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_code text;
  v_device_key   text;
  v_id           uuid;
BEGIN
  -- Generate unique request_code
  LOOP
    v_request_code := public.generate_device_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM device_registration_requests WHERE request_code = v_request_code);
  END LOOP;

  -- Generate unique device_key
  v_device_key := 'tablet_' || lower(string_agg(
    substr('abcdefghijklmnopqrstuvwxyz0123456789',
      1 + floor(random() * 36)::int, 1), ''))
  FROM generate_series(1, 10);

  INSERT INTO device_registration_requests (id, request_code, device_key, site_name, device_info, user_agent, status)
  VALUES (gen_random_uuid(), v_request_code, v_device_key, p_site_name, p_device_info, p_user_agent, 'pending')
  RETURNING id INTO v_id;

  request_code := v_request_code;
  device_key := v_device_key;
  RETURN NEXT;
  RETURN;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_device_request(text, text, text) TO anon, authenticated;

-- ── 4. approve_device_request ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.approve_device_request(
  p_request_id uuid
)
RETURNS TABLE (approval_code text, device_key text, site_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approval_code text;
  v_status        text;
  v_device_key    text;
  v_site_name     text;
BEGIN
  SELECT status, device_key, site_name INTO v_status, v_device_key, v_site_name
  FROM device_registration_requests WHERE id = p_request_id;

  IF NOT FOUND THEN
    approval_code := NULL; RETURN NEXT; RETURN;
  END IF;

  IF v_status != 'pending' THEN
    approval_code := NULL; RETURN NEXT; RETURN;
  END IF;

  -- Generate unique approval_code
  LOOP
    v_approval_code := public.generate_device_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM device_registration_requests WHERE approval_code = v_approval_code);
  END LOOP;

  UPDATE device_registration_requests
  SET status = 'approved',
      approval_code = v_approval_code,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = p_request_id;

  approval_code := v_approval_code;
  device_key := v_device_key;
  site_name := v_site_name;
  RETURN NEXT;
  RETURN;
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_device_request(uuid) TO authenticated;

-- ── 5. complete_device_request ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.complete_device_request(
  p_request_code   text,
  p_approval_code  text
)
RETURNS TABLE (success boolean, device_key text, site_name text, error_msg text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec          device_registration_requests%ROWTYPE;
  v_kiosk_exists uuid;
BEGIN
  SELECT * INTO v_rec FROM device_registration_requests
  WHERE request_code = upper(p_request_code) AND status = 'approved';

  IF NOT FOUND THEN
    success := false; device_key := NULL; site_name := NULL;
    error_msg := 'Solicitud no encontrada o no aprobada'; RETURN NEXT; RETURN;
  END IF;

  IF v_rec.approval_code IS NULL OR v_rec.approval_code != upper(p_approval_code) THEN
    success := false; device_key := NULL; site_name := NULL;
    error_msg := 'Código de aprobación incorrecto'; RETURN NEXT; RETURN;
  END IF;

  -- Check if device_key already exists in kiosk_devices
  SELECT id INTO v_kiosk_exists FROM kiosk_devices WHERE device_key = v_rec.device_key LIMIT 1;
  IF v_kiosk_exists IS NULL THEN
    INSERT INTO kiosk_devices (device_key, site_name, is_active, notes)
    VALUES (v_rec.device_key, v_rec.site_name, true, 'Auto-registrado');
  END IF;

  UPDATE device_registration_requests
  SET status = 'completed', completed_at = now()
  WHERE id = v_rec.id;

  success := true;
  device_key := v_rec.device_key;
  site_name := v_rec.site_name;
  error_msg := NULL;
  RETURN NEXT;
  RETURN;
END;
$$;
GRANT EXECUTE ON FUNCTION public.complete_device_request(text, text) TO anon, authenticated;

-- ── 6. Set all existing employees to kiosk_only ───────────────────────────

UPDATE empleados SET fichaje_mode = 'kiosk_only' WHERE fichaje_mode = 'any' OR fichaje_mode IS NULL;
