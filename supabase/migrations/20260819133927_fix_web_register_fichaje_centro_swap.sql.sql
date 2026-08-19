/*
# Add centro auto-swap to web_register_fichaje + clean test data

## Problem
The web kiosk uses `web_register_fichaje` to register clock-ins. Unlike the
tablet function `kiosk_register_fichaje`, the web version did NOT update the
employee's `centro_id`/`centro_trabajo` when clocking in at a device linked to
a centro. So when Julio (currently assigned to PISO ZEUS) clocked in at the
Oficina SVF device, his centro stayed as PISO ZEUS and the PRL documents
continued to show the wrong centro.

## Fix
1. Update `web_register_fichaje` so that on an ENTRADA event, if the kiosk
   device has a `centro_id`, the employee's `centro_id` and `centro_trabajo`
   are updated to that centro, and the change is recorded in
   `employee_centro_history` (one entry per employee+centro per day). This
   mirrors the logic already present in `kiosk_register_fichaje`.
2. The fichajes row is also updated to store `centro_id` and `centro_nombre`
   on insert.
3. Clean up the test employee Julio (user_id
   f8467e1f-b07b-4221-84d4-8c444c52c948): set centro_id and centro_trabajo to
   NULL and delete his employee_centro_history rows, so he starts clean for
   the fichaje test.

## Tables / functions affected
- `web_register_fichaje` (function) — centro-swap logic added.
- `empleados` — one row updated (Julio) to clear centro.
- `employee_centro_history` — rows deleted for Julio.
- `fichajes` — new inserts now also store centro_id and centro_nombre.

## Security
No RLS policy changes. The function remains SECURITY DEFINER with search_path
public, same grants to anon + authenticated.
*/

CREATE OR REPLACE FUNCTION public.web_register_fichaje(
  p_tipo_evento      text,
  p_latitud          double precision DEFAULT NULL,
  p_longitud         double precision DEFAULT NULL,
  p_ubicacion        text             DEFAULT NULL,
  p_dispositivo      text             DEFAULT NULL,
  p_user_agent       text             DEFAULT NULL,
  p_device_key       text             DEFAULT NULL,
  p_es_manual        boolean          DEFAULT false,
  p_nota_correccion  text             DEFAULT NULL,
  p_pin              text             DEFAULT NULL
)
RETURNS TABLE(success boolean, tipo text, nombre_empleado text, error_msg text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid := auth.uid();
  v_nombre        text;
  v_empleado_id   uuid;
  v_fichaje_mode  text;
  v_today         date := current_date;
  v_last_event    text;
  v_next_tipo     text;
  v_device_id     uuid;
  v_is_kiosk      boolean := false;
  v_is_corporate  boolean := false;
  v_centro_id     uuid;
  v_centro_nombre text;
BEGIN
  -- ── Identify via PIN when there is no login session ─────────────────────
  IF v_user_id IS NULL AND p_pin IS NOT NULL AND p_pin <> '' THEN
    SELECT vp.id, vp.nombre
    INTO   v_user_id, v_nombre
    FROM   validate_vehicle_pin(p_pin) vp
    LIMIT  1;

    IF v_user_id IS NULL THEN
      success := false; tipo := NULL; nombre_empleado := NULL;
      error_msg := 'PIN_INCORRECTO'; RETURN NEXT; RETURN;
    END IF;
  END IF;

  -- ── Require identification ───────────────────────────────────────────────
  IF v_user_id IS NULL THEN
    success := false; tipo := NULL; nombre_empleado := NULL;
    error_msg := 'No autenticado'; RETURN NEXT; RETURN;
  END IF;

  -- ── Find employee + fichaje_mode ─────────────────────────────────────────
  SELECT e.id, e.nombre, COALESCE(e.fichaje_mode, 'kiosk_only')
  INTO   v_empleado_id, v_nombre, v_fichaje_mode
  FROM   empleados e
  WHERE  e.user_id = v_user_id
  LIMIT  1;

  IF v_empleado_id IS NULL THEN
    SELECT up.nombre INTO v_nombre
    FROM   user_profiles up
    WHERE  up.id = v_user_id
    LIMIT  1;

    IF v_nombre IS NULL THEN
      success := false; tipo := NULL; nombre_empleado := NULL;
      error_msg := 'Empleado no encontrado'; RETURN NEXT; RETURN;
    END IF;
  END IF;

  -- ── Validate device against employee mode ────────────────────────────────
  IF v_fichaje_mode = 'any' THEN
    IF p_device_key IS NOT NULL THEN
      SELECT id, centro_id INTO v_device_id, v_centro_id
      FROM   kiosk_devices
      WHERE  device_key = p_device_key AND is_active = true
      LIMIT  1;
      IF v_device_id IS NOT NULL THEN v_is_kiosk := true; END IF;
    END IF;

  ELSIF v_fichaje_mode = 'kiosk_only' THEN
    IF p_device_key IS NULL THEN
      success := false; tipo := NULL; nombre_empleado := v_nombre;
      error_msg := 'DEVICE_NOT_AUTHORIZED'; RETURN NEXT; RETURN;
    END IF;
    SELECT id, centro_id INTO v_device_id, v_centro_id
    FROM   kiosk_devices
    WHERE  device_key = p_device_key AND is_active = true
    LIMIT  1;
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
    SELECT id, centro_id INTO v_device_id, v_centro_id
    FROM   kiosk_devices
    WHERE  device_key = p_device_key AND is_active = true
    LIMIT  1;
    IF v_device_id IS NOT NULL THEN
      v_is_kiosk := true;
    ELSE
      SELECT id INTO v_device_id
      FROM   employee_registered_devices
      WHERE  device_key = p_device_key
        AND  empleado_id = v_empleado_id
        AND  is_active = true
      LIMIT  1;
      IF v_device_id IS NOT NULL THEN
        v_is_corporate := true;
      ELSE
        success := false; tipo := NULL; nombre_empleado := v_nombre;
        error_msg := 'DEVICE_NOT_AUTHORIZED'; RETURN NEXT; RETURN;
      END IF;
    END IF;
  END IF;

  -- ── Resolve centro name from device centro_id ────────────────────────────
  IF v_centro_id IS NOT NULL THEN
    SELECT c.nombre INTO v_centro_nombre FROM centros c WHERE c.id = v_centro_id LIMIT 1;
  END IF;

  -- ── Mandatory location for entrada ──────────────────────────────────────
  IF p_tipo_evento = 'entrada' AND p_es_manual = false THEN
    IF (p_latitud IS NULL OR p_longitud IS NULL) AND p_ubicacion IS NULL THEN
      success := false; tipo := NULL; nombre_empleado := v_nombre;
      error_msg := 'LOCATION_REQUIRED'; RETURN NEXT; RETURN;
    END IF;
  END IF;

  -- ── Lock today's rows to prevent race conditions ─────────────────────────
  PERFORM 1 FROM fichajes f
  WHERE f.nombre_empleado = v_nombre AND f.fecha = v_today
  FOR UPDATE;

  -- ── Determine next event type ────────────────────────────────────────────
  IF p_tipo_evento IS NULL OR p_tipo_evento = '' THEN
    SELECT f.tipo_evento INTO v_last_event
    FROM   fichajes f
    WHERE  f.nombre_empleado = v_nombre AND f.fecha = v_today
    ORDER  BY f.timestamp DESC
    LIMIT  1;
    IF v_last_event = 'entrada' THEN
      v_next_tipo := 'salida';
    ELSE
      v_next_tipo := 'entrada';
    END IF;
  ELSE
    v_next_tipo := p_tipo_evento;
  END IF;
  tipo := v_next_tipo;

  -- ── Insert fichaje (now with centro_id + centro_nombre) ──────────────────
  INSERT INTO fichajes (
    empleado_id, nombre_empleado, fecha, timestamp, tipo_evento,
    metodo, user_agent, dispositivo, es_manual,
    latitud, longitud, ubicacion,
    kiosk_device_id, centro_id, centro_nombre, nota_correccion
  ) VALUES (
    v_empleado_id, v_nombre, v_today, now(), v_next_tipo,
    'web', p_user_agent,
    COALESCE(p_dispositivo, p_device_key),
    p_es_manual,
    p_latitud, p_longitud, p_ubicacion,
    CASE WHEN v_is_kiosk THEN v_device_id ELSE NULL END,
    v_centro_id, v_centro_nombre,
    p_nota_correccion
  );

  -- ── Auto-update employee centro on ENTRADA (centro swap) ─────────────────
  IF v_next_tipo = 'entrada' AND v_centro_id IS NOT NULL THEN
    UPDATE empleados
    SET centro_trabajo = v_centro_nombre,
        centro_id = v_centro_id
    WHERE id = v_empleado_id
      AND (centro_id IS DISTINCT FROM v_centro_id);

    INSERT INTO employee_centro_history (empleado_id, centro_id, centro_nombre, fecha)
    SELECT v_empleado_id, v_centro_id, v_centro_nombre, v_today
    WHERE NOT EXISTS (
      SELECT 1 FROM employee_centro_history ech
      WHERE ech.empleado_id = v_empleado_id
        AND ech.centro_id = v_centro_id
        AND ech.fecha = v_today
    );
  END IF;

  -- ── Update device last_seen_at ───────────────────────────────────────────
  IF v_is_kiosk AND v_device_id IS NOT NULL THEN
    UPDATE kiosk_devices SET last_seen_at = now() WHERE id = v_device_id;
  ELSIF v_is_corporate AND v_device_id IS NOT NULL THEN
    UPDATE employee_registered_devices SET last_seen_at = now() WHERE id = v_device_id;
  END IF;

  success := true; nombre_empleado := v_nombre; error_msg := NULL;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.web_register_fichaje(
  text, double precision, double precision, text, text, text, text, boolean, text, text
) TO anon, authenticated;

-- ── Clean up Julio's PISO ZEUS test assignment ─────────────────────────────
UPDATE empleados
SET centro_id = NULL,
    centro_trabajo = NULL
WHERE user_id = 'f8467e1f-b07b-4221-84d4-8c444c52c948';

DELETE FROM employee_centro_history
WHERE empleado_id = (
  SELECT id FROM empleados WHERE user_id = 'f8467e1f-b07b-4221-84d4-8c444c52c948' LIMIT 1
);
