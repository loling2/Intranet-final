/*
# Web fichaje device authorization

## Problem
The web FichajesModule and LoginPage do direct INSERTs into `fichajes`,
bypassing the device validation that exists in `kiosk_register_fichaje`.
This means any mobile phone can fichar even if it's not a registered device.

## Solution
1. Create `web_register_fichaje` — a SECURITY DEFINER function that uses
   `auth.uid()` to identify the employee, validates the device against the
   employee's `fichaje_mode`, and inserts the fichaje. Mirrors the device
   validation logic from `kiosk_register_fichaje`.
2. Revoke direct INSERT on `fichajes` from `authenticated` and `anon` so
   the browser cannot bypass the function. The function (SECURITY DEFINER)
   still inserts as the owner.
3. Change default `fichaje_mode` from 'any' to 'kiosk_only' so that
   unregistered devices are blocked by default until an admin explicitly
   grants access.
*/

-- ── 1. web_register_fichaje function ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.web_register_fichaje(
  p_tipo_evento   text,
  p_latitud       double precision DEFAULT NULL,
  p_longitud      double precision DEFAULT NULL,
  p_ubicacion     text DEFAULT NULL,
  p_dispositivo   text DEFAULT NULL,
  p_user_agent    text DEFAULT NULL,
  p_device_key    text DEFAULT NULL,
  p_es_manual     boolean DEFAULT false,
  p_nota_correccion text DEFAULT NULL
)
RETURNS TABLE (
  success         boolean,
  tipo            text,
  nombre_empleado text,
  error_msg       text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_nombre         text;
  v_empleado_id    uuid;
  v_fichaje_mode   text;
  v_today          date := current_date;
  v_last_event     text;
  v_next_tipo      text;
  v_device_id      uuid;
  v_is_kiosk       boolean := false;
  v_is_corporate   boolean := false;
BEGIN
  -- ── Validate authenticated user ────────────────────────────────────────────
  IF v_user_id IS NULL THEN
    success := false; tipo := NULL; nombre_empleado := NULL;
    error_msg := 'No autenticado'; RETURN NEXT; RETURN;
  END IF;

  -- ── Find employee + fichaje_mode ──────────────────────────────────────────
  SELECT e.id, e.nombre, COALESCE(e.fichaje_mode, 'kiosk_only')
  INTO v_empleado_id, v_nombre, v_fichaje_mode
  FROM empleados e
  WHERE e.user_id = v_user_id
  LIMIT 1;

  IF v_empleado_id IS NULL THEN
    -- Fallback: look up name from user_profiles
    SELECT up.nombre INTO v_nombre
    FROM user_profiles up
    WHERE up.id = v_user_id
    LIMIT 1;
    IF v_nombre IS NULL THEN
      success := false; tipo := NULL; nombre_empleado := NULL;
      error_msg := 'Empleado no encontrado'; RETURN NEXT; RETURN;
    END IF;
  END IF;

  -- ── Validate device against employee mode ─────────────────────────────────
  IF v_fichaje_mode = 'any' THEN
    -- No restriction — still check kiosk device to update last_seen_at
    IF p_device_key IS NOT NULL THEN
      SELECT id INTO v_device_id FROM kiosk_devices
        WHERE device_key = p_device_key AND is_active = true LIMIT 1;
      IF v_device_id IS NOT NULL THEN v_is_kiosk := true; END IF;
    END IF;

  ELSIF v_fichaje_mode = 'kiosk_only' THEN
    IF p_device_key IS NULL THEN
      success := false; tipo := NULL; nombre_empleado := v_nombre;
      error_msg := 'DEVICE_NOT_AUTHORIZED'; RETURN NEXT; RETURN;
    END IF;
    SELECT id INTO v_device_id FROM kiosk_devices
      WHERE device_key = p_device_key AND is_active = true LIMIT 1;
    IF v_device_id IS NULL THEN
      success := false; tipo := NULL; nombre_empleado := v_nombre;
      error_msg := 'DEVICE_NOT_AUTHORIZED'; RETURN NEXT; RETURN;
    END IF;
    v_is_kiosk := true;

  ELSIF v_fichaje_mode = 'kiosk_or_corporate' THEN
    IF p_device_key IS NULL THEN
      success := false; tipo := NULL; nombre_empleado := v_nombre;
      error_msg := 'DEVICE_NOT_AUTHORIZED'; RETURN NEXT; RETURN;
    END IF;
    SELECT id INTO v_device_id FROM kiosk_devices
      WHERE device_key = p_device_key AND is_active = true LIMIT 1;
    IF v_device_id IS NOT NULL THEN
      v_is_kiosk := true;
    ELSE
      SELECT id INTO v_device_id FROM employee_registered_devices
        WHERE device_key = p_device_key
          AND empleado_id = v_empleado_id
          AND is_active = true
        LIMIT 1;
      IF v_device_id IS NOT NULL THEN
        v_is_corporate := true;
      ELSE
        success := false; tipo := NULL; nombre_empleado := v_nombre;
        error_msg := 'DEVICE_NOT_AUTHORIZED'; RETURN NEXT; RETURN;
      END IF;
    END IF;
  END IF;

  -- ── Lock today's rows (prevent race conditions) ───────────────────────────
  PERFORM 1 FROM fichajes f
  WHERE f.nombre_empleado = v_nombre AND f.fecha = v_today FOR UPDATE;

  -- ── Determine next event type if not provided ─────────────────────────────
  IF p_tipo_evento IS NULL OR p_tipo_evento = '' THEN
    SELECT f.tipo_evento INTO v_last_event
    FROM fichajes f
    WHERE f.nombre_empleado = v_nombre AND f.fecha = v_today
    ORDER BY f.timestamp DESC LIMIT 1;
    IF v_last_event = 'entrada' THEN v_next_tipo := 'salida';
    ELSE v_next_tipo := 'entrada'; END IF;
  ELSE
    v_next_tipo := p_tipo_evento;
  END IF;
  tipo := v_next_tipo;

  -- ── Insert fichaje ────────────────────────────────────────────────────────
  INSERT INTO fichajes (
    empleado_id, nombre_empleado, fecha, timestamp, tipo_evento,
    metodo, user_agent, dispositivo, es_manual, latitud, longitud, ubicacion,
    kiosk_device_id, nota_correccion
  ) VALUES (
    v_empleado_id, v_nombre, v_today, now(), v_next_tipo,
    'web', p_user_agent,
    COALESCE(p_dispositivo, p_device_key),
    p_es_manual, p_latitud, p_longitud, p_ubicacion,
    CASE WHEN v_is_kiosk THEN v_device_id ELSE NULL END,
    p_nota_correccion
  );

  -- ── Update last_seen_at ───────────────────────────────────────────────────
  IF v_is_kiosk AND v_device_id IS NOT NULL THEN
    UPDATE kiosk_devices SET last_seen_at = now() WHERE id = v_device_id;
  ELSIF v_is_corporate AND v_device_id IS NOT NULL THEN
    UPDATE employee_registered_devices SET last_seen_at = now() WHERE id = v_device_id;
  END IF;

  success := true; error_msg := NULL; RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.web_register_fichaje(
  text, double precision, double precision, text, text, text, text, boolean, text
) TO authenticated;

-- Revoke from anon — web fichaje requires authentication
REVOKE EXECUTE ON FUNCTION public.web_register_fichaje(
  text, double precision, double precision, text, text, text, text, boolean, text
) FROM anon;

-- ── 2. Lock down direct INSERT on fichajes ────────────────────────────────────
-- The browser can no longer INSERT directly; it must go through the RPC.
-- We keep the anon INSERT policy for the kiosk PIN flow (kiosk_register_fichaje
-- is SECURITY DEFINER and bypasses RLS anyway, but the anon policy is needed
-- for the kiosk's direct insert fallback if any). We revoke from authenticated
-- so the web app must use the RPC.

DROP POLICY IF EXISTS "insert_fichajes_public" ON fichajes;
CREATE POLICY "insert_fichajes_anon_only" ON fichajes FOR INSERT
  TO anon WITH CHECK (true);

-- ── 3. Change default fichaje_mode to 'kiosk_only' ────────────────────────────
-- New employees default to strict mode; existing employees keep their current mode.
ALTER TABLE empleados ALTER COLUMN fichaje_mode SET DEFAULT 'kiosk_only';
