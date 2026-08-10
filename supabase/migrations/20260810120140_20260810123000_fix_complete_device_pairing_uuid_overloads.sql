/*
# Fix device pairing function type ambiguity

## Purpose
Corrects the device registration function so corporate devices can be assigned to
an employee without attempting to write a text value into the UUID employee_id column.

## Changes
- Removes the three older overloaded `complete_device_pairing` signatures.
- Creates one canonical six-argument function.
- Makes `p_empleado_id` a UUID and keeps it optional for kiosk tablets.
- Preserves both registration paths:
  1. `kiosk` creates a row in `kiosk_devices`.
  2. `corporate` creates a row in `employee_registered_devices` assigned to the selected employee.
- Keeps device labels, activity timestamps, confirmation checks, expiry checks, and duplicate protection.

## Data safety
- No tables, columns, rows, or existing devices are deleted.
- Existing pending and confirmed pairing requests remain available.

## Security
- The function remains SECURITY DEFINER with a fixed `public` search path.
- Execution is granted to the frontend roles already used by the application.

## Important notes
1. The frontend can continue calling the function with only the original three parameters for kiosk compatibility because the last three parameters have defaults.
2. Corporate registration must provide a valid employee UUID.
*/

DROP FUNCTION IF EXISTS public.complete_device_pairing(uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.complete_device_pairing(uuid, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.complete_device_pairing(uuid, text, text);

CREATE FUNCTION public.complete_device_pairing(
  p_request_id uuid,
  p_device_key text,
  p_confirm_code text,
  p_device_type text DEFAULT 'kiosk',
  p_empleado_id uuid DEFAULT NULL,
  p_device_label text DEFAULT NULL
)
RETURNS TABLE(success boolean, error_msg text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_request public.device_pairing_requests%ROWTYPE;
  v_device_type text := lower(trim(coalesce(p_device_type, '')));
  v_label text;
BEGIN
  SELECT * INTO v_request
  FROM public.device_pairing_requests
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

  IF v_request.device_key <> p_device_key
     OR v_request.confirm_code IS NULL
     OR v_request.confirm_code <> p_confirm_code THEN
    RETURN QUERY SELECT false, 'Código de confirmación incorrecto';
    RETURN;
  END IF;

  IF v_device_type NOT IN ('kiosk', 'corporate') THEN
    RETURN QUERY SELECT false, 'Selecciona si es una tablet de kiosco o un móvil corporativo';
    RETURN;
  END IF;

  IF v_device_type = 'corporate' AND p_empleado_id IS NULL THEN
    RETURN QUERY SELECT false, 'Selecciona el empleado del móvil corporativo';
    RETURN;
  END IF;

  v_label := COALESCE(
    NULLIF(trim(p_device_label), ''),
    NULLIF(trim(v_request.site_name), ''),
    CASE WHEN v_device_type = 'corporate' THEN 'Móvil corporativo' ELSE 'Dispositivo sin nombre' END
  );

  BEGIN
    IF v_device_type = 'kiosk' THEN
      INSERT INTO public.kiosk_devices (device_key, site_name, is_active, last_seen_at)
      VALUES (v_request.device_key, v_label, true, now());
    ELSE
      INSERT INTO public.employee_registered_devices
        (empleado_id, device_key, device_label, is_active, last_seen_at)
      VALUES
        (p_empleado_id, v_request.device_key, v_label, true, now());
    END IF;
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT false, 'Este dispositivo ya está registrado para ese destino';
    RETURN;
  END;

  UPDATE public.device_pairing_requests
  SET device_type = v_device_type,
      empleado_id = p_empleado_id,
      device_label = v_label
  WHERE id = v_request.id;

  DELETE FROM public.device_pairing_requests
  WHERE id = v_request.id;

  RETURN QUERY SELECT true, NULL::text;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.complete_device_pairing(uuid, text, text, text, uuid, text) TO anon, authenticated;
