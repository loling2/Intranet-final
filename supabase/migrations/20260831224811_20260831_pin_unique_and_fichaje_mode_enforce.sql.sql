/*
# PIN único y restricción de fichaje_mode en kiosk_register_fichaje

## 1. PIN único para usuarios activos
- Añade un índice UNIQUE parcial en `user_profiles(pin)` donde `activo = true`.
- Esto evita que dos usuarios activos compartan el mismo PIN.
- Los usuarios inactivos pueden tener PINs duplicados (no causan conflicto en el kiosco).

## 2. Restaurar validación de fichaje_mode en kiosk_register_fichaje
- La función fue sobreescrita por migraciones posteriores que eliminaron
  la validación del modo de fichaje, permitiendo a empleados con modo
  `kiosk_only` fichar desde móviles.
- Esta versión restaura la validación completa:
  - `kiosk_only`: solo tablets kiosco autorizadas
  - `kiosk_or_corporate`: kiosco o móvil corporativo registrado
  - `any`: cualquier dispositivo
- Mantiene la lógica de centro_id/centro_nombre de migraciones anteriores.

## 3. Notas
- El índice UNIQUE es parcial (WHERE activo = true) para no romper
  usuarios inactivos existentes que puedan tener PINs duplicados.
- La función sigue siendo SECURITY DEFINER con search_path = public.
*/

-- ── 1. Índice único parcial en PIN ──────────────────────────────────────────

-- Limpia PINs duplicados existentes entre usuarios activos antes de crear el índice.
-- Si hay duplicados, los dejamos como NULL en los usuarios más recientes.
DO $$
DECLARE
  dup_record RECORD;
BEGIN
  FOR dup_record IN
    SELECT pin
    FROM user_profiles
    WHERE activo = true AND pin IS NOT NULL
    GROUP BY pin
    HAVING COUNT(*) > 1
  LOOP
    -- Mantener el PIN del usuario más antiguo, NULL en el resto
    UPDATE user_profiles
    SET pin = NULL
    WHERE pin = dup_record.pin
      AND activo = true
      AND id NOT IN (
        SELECT id FROM user_profiles
        WHERE pin = dup_record.pin AND activo = true
        ORDER BY created_at ASC
        LIMIT 1
      );
  END LOOP;
END $$;

-- Crear índice único parcial
DROP INDEX IF EXISTS idx_user_profiles_pin_unique_active;
CREATE UNIQUE INDEX idx_user_profiles_pin_unique_active
  ON user_profiles(pin)
  WHERE activo = true AND pin IS NOT NULL;

-- ── 2. Restaurar kiosk_register_fichaje con validación de fichaje_mode ────────

CREATE OR REPLACE FUNCTION public.kiosk_register_fichaje(
  p_pin            text,
  p_latitud        double precision DEFAULT NULL,
  p_longitud       double precision DEFAULT NULL,
  p_ubicacion      text DEFAULT NULL,
  p_dispositivo    text DEFAULT NULL,
  p_user_agent     text DEFAULT NULL,
  p_device_key     text DEFAULT NULL
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
  v_user_id        uuid;
  v_nombre         text;
  v_empleado_id    uuid;
  v_fichaje_mode   text;
  v_today          date := current_date;
  v_last_event     text;
  v_next_tipo      text;
  v_device_id      uuid;
  v_site_name      text;
  v_centro_id      uuid;
  v_centro_nombre  text;
  v_is_kiosk       boolean := false;
  v_is_corporate   boolean := false;
BEGIN
  -- ── Validate PIN ──────────────────────────────────────────────────────────
  SELECT vp.id, vp.nombre INTO v_user_id, v_nombre
  FROM validate_vehicle_pin(p_pin) vp
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'PIN incorrecto';
    RETURN;
  END IF;

  -- ── Find employee + fichaje_mode ──────────────────────────────────────────
  SELECT e.id, COALESCE(e.fichaje_mode, 'any')
  INTO v_empleado_id, v_fichaje_mode
  FROM empleados e
  WHERE e.user_id = v_user_id
  LIMIT 1;

  IF v_empleado_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, v_nombre, 'Empleado no encontrado';
    RETURN;
  END IF;

  -- ── Validate device against employee mode ─────────────────────────────────
  IF v_fichaje_mode = 'kiosk_only' THEN
    -- Must come from an active kiosk device
    IF p_device_key IS NULL THEN
      RETURN QUERY SELECT false, NULL::text, v_nombre, 'DEVICE_NOT_AUTHORIZED';
      RETURN;
    END IF;
    SELECT id, site_name, centro_id INTO v_device_id, v_site_name, v_centro_id
    FROM kiosk_devices
    WHERE device_key = p_device_key AND is_active = true
    LIMIT 1;
    IF v_device_id IS NULL THEN
      RETURN QUERY SELECT false, NULL::text, v_nombre, 'DEVICE_NOT_AUTHORIZED';
      RETURN;
    END IF;
    v_is_kiosk := true;

  ELSIF v_fichaje_mode = 'kiosk_or_corporate' THEN
    -- Must come from active kiosk OR active corporate device assigned to this employee
    IF p_device_key IS NULL THEN
      RETURN QUERY SELECT false, NULL::text, v_nombre, 'DEVICE_NOT_AUTHORIZED';
      RETURN;
    END IF;
    -- Check kiosk first
    SELECT id, site_name, centro_id INTO v_device_id, v_site_name, v_centro_id
    FROM kiosk_devices
    WHERE device_key = p_device_key AND is_active = true
    LIMIT 1;
    IF v_device_id IS NOT NULL THEN
      v_is_kiosk := true;
    ELSE
      -- Check corporate device assigned to this employee
      SELECT id INTO v_device_id
      FROM employee_registered_devices
      WHERE device_key = p_device_key
        AND empleado_id = v_empleado_id
        AND is_active = true
      LIMIT 1;
      IF v_device_id IS NOT NULL THEN
        v_is_corporate := true;
      ELSE
        RETURN QUERY SELECT false, NULL::text, v_nombre, 'DEVICE_NOT_AUTHORIZED';
        RETURN;
      END IF;
    END IF;

  ELSE
    -- mode = 'any': no restriction, but check kiosk device for last_seen + centro
    IF p_device_key IS NOT NULL THEN
      SELECT id, site_name, centro_id INTO v_device_id, v_site_name, v_centro_id
      FROM kiosk_devices
      WHERE device_key = p_device_key AND is_active = true
      LIMIT 1;
      IF v_device_id IS NOT NULL THEN
        v_is_kiosk := true;
      END IF;
    END IF;
  END IF;

  -- ── Get centro name if we have a centro_id ─────────────────────────────────
  IF v_centro_id IS NOT NULL THEN
    SELECT c.nombre INTO v_centro_nombre FROM centros c WHERE c.id = v_centro_id LIMIT 1;
  END IF;

  -- ── Lock today's rows (prevent race conditions) ───────────────────────────
  PERFORM 1 FROM fichajes f
  WHERE f.empleado_id = v_empleado_id AND f.fecha = v_today
  FOR UPDATE;

  -- ── Determine next event type ─────────────────────────────────────────────
  SELECT f.tipo_evento INTO v_last_event
  FROM fichajes f
  WHERE f.empleado_id = v_empleado_id AND f.fecha = v_today
  ORDER BY f.timestamp DESC LIMIT 1;

  v_next_tipo := CASE WHEN v_last_event = 'entrada' THEN 'salida' ELSE 'entrada' END;

  -- ── Insert fichaje ────────────────────────────────────────────────────────
  INSERT INTO fichajes (
    empleado_id, nombre_empleado, fecha, timestamp, tipo_evento,
    metodo, user_agent, dispositivo, es_manual,
    latitud, longitud, ubicacion,
    kiosk_device_id, centro_id, centro_nombre
  ) VALUES (
    v_empleado_id, v_nombre, v_today, now(), v_next_tipo,
    'pin', p_user_agent,
    COALESCE(p_dispositivo, p_device_key),
    false,
    p_latitud, p_longitud, p_ubicacion,
    CASE WHEN v_is_kiosk THEN v_device_id ELSE NULL END,
    v_centro_id, COALESCE(v_centro_nombre, v_site_name)
  );

  -- ── Auto-update employee's centro on ENTRADA when device has a centro ──────
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

  -- ── Update last_seen_at ───────────────────────────────────────────────────
  IF v_is_kiosk AND v_device_id IS NOT NULL THEN
    UPDATE kiosk_devices SET last_seen_at = now() WHERE id = v_device_id;
  ELSIF v_is_corporate AND v_device_id IS NOT NULL THEN
    UPDATE employee_registered_devices SET last_seen_at = now() WHERE id = v_device_id;
  END IF;

  RETURN QUERY SELECT true, v_next_tipo, v_nombre, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_register_fichaje(text, double precision, double precision, text, text, text, text) TO anon, authenticated;
