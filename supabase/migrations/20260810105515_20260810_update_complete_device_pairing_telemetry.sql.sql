/*
# Update complete_device_pairing to set last_seen_at on registration

## Purpose
When a device completes pairing, its `last_seen_at` should be set to `now()` so it
immediately appears as "online" in the Telemetría tab — instead of showing as
"never used" until the first fichaje.

## Changes
- `complete_device_pairing()` function updated: the INSERT into `kiosk_devices`
  now includes `last_seen_at = now()` so the device shows up in telemetry right away.

## Security
- No RLS or policy changes. The function remains SECURITY DEFINER with search_path = 'public'.
*/

CREATE OR REPLACE FUNCTION public.complete_device_pairing(p_request_id uuid, p_device_key text, p_confirm_code text)
RETURNS TABLE(success boolean, error_msg text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_request device_pairing_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_request
  FROM device_pairing_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Solicitud no encontrada';
    RETURN;
  END IF;

  IF v_request.status <> 'confirmed' OR v_request.expires_at <= now() THEN
    RETURN QUERY SELECT false, 'La solicitud ha caducado o no está autorizada';
    RETURN;
  END IF;

  IF v_request.device_key <> p_device_key OR v_request.confirm_code IS NULL OR v_request.confirm_code <> p_confirm_code THEN
    RETURN QUERY SELECT false, 'Código de confirmación incorrecto';
    RETURN;
  END IF;

  BEGIN
    INSERT INTO kiosk_devices (device_key, site_name, is_active, last_seen_at)
    VALUES (v_request.device_key, COALESCE(NULLIF(trim(v_request.site_name), ''), 'Dispositivo sin nombre'), true, now());
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT false, 'Este dispositivo ya está registrado';
    RETURN;
  END;

  DELETE FROM device_pairing_requests WHERE id = v_request.id;
  RETURN QUERY SELECT true, NULL::text;
END;
$function$;
