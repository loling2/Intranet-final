/*
# Control de modo de fichaje por empleado + dispositivos registrados

## Descripción
Permite configurar, para cada empleado, desde qué tipo de dispositivo puede fichar:
- `kiosk_only` — Solo desde tablets de kiosco autorizadas (stricto)
- `kiosk_or_corporate` — Desde tablets de kiosco O desde su móvil corporativo registrado
- `any` — Desde cualquier dispositivo (sin restricción)

## Nuevas tablas

### `employee_registered_devices`
Registra dispositivos corporativos (móviles) asignados a empleados concretos.
- `id` — UUID primario
- `empleado_id` — FK a empleados.id
- `device_key` — Clave del dispositivo (igual que kiosk_devices)
- `device_label` — Etiqueta descriptiva (ej: "iPhone 13 corporativo")
- `is_active` — Si el dispositivo está habilitado
- `created_at` / `last_seen_at`

## Columnas nuevas

### `empleados.fichaje_mode`
- Tipo: text, NOT NULL, DEFAULT 'any'
- Valores válidos: 'kiosk_only' | 'kiosk_or_corporate' | 'any'
- 'any' como default preserva el comportamiento actual para todos los empleados existentes

## Actualización de `kiosk_register_fichaje`
La función ahora consulta el `fichaje_mode` del empleado tras validar el PIN:
- Si mode = 'kiosk_only': requiere device_key de un kiosk_device activo
- Si mode = 'kiosk_or_corporate': acepta kiosk_device activo OR employee_registered_device activo del empleado
- Si mode = 'any': acepta cualquier dispositivo (incluido NULL)

## Seguridad
- RLS en `employee_registered_devices`: anon + authenticated pueden leer; solo authenticated puede escribir
- La validación ocurre en SECURITY DEFINER (server-side, no evitable desde el cliente)
*/

-- ── 1. Columna fichaje_mode en empleados ─────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'empleados' AND column_name = 'fichaje_mode'
  ) THEN
    ALTER TABLE empleados ADD COLUMN fichaje_mode text NOT NULL DEFAULT 'any';
  END IF;
END $$;

-- Check constraint para valores válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'empleados_fichaje_mode_check'
  ) THEN
    ALTER TABLE empleados ADD CONSTRAINT empleados_fichaje_mode_check
      CHECK (fichaje_mode IN ('kiosk_only', 'kiosk_or_corporate', 'any'));
  END IF;
END $$;

-- ── 2. Tabla employee_registered_devices ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS employee_registered_devices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id   uuid NOT NULL,
  device_key    text NOT NULL,
  device_label  text NOT NULL DEFAULT '',
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz,
  UNIQUE (empleado_id, device_key)
);

CREATE INDEX IF NOT EXISTS idx_emp_devices_empleado ON employee_registered_devices(empleado_id);
CREATE INDEX IF NOT EXISTS idx_emp_devices_key ON employee_registered_devices(device_key);

ALTER TABLE employee_registered_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emp_devices_select" ON employee_registered_devices;
CREATE POLICY "emp_devices_select" ON employee_registered_devices FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "emp_devices_insert" ON employee_registered_devices;
CREATE POLICY "emp_devices_insert" ON employee_registered_devices FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "emp_devices_update" ON employee_registered_devices;
CREATE POLICY "emp_devices_update" ON employee_registered_devices FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "emp_devices_delete" ON employee_registered_devices;
CREATE POLICY "emp_devices_delete" ON employee_registered_devices FOR DELETE
  TO authenticated USING (true);

-- ── 3. Actualizar kiosk_register_fichaje con validación de modo ───────────────

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
  v_is_kiosk       boolean := false;
  v_is_corporate   boolean := false;
BEGIN
  -- ── Validate PIN ──────────────────────────────────────────────────────────
  SELECT vp.id, vp.nombre INTO v_user_id, v_nombre
  FROM validate_vehicle_pin(p_pin) vp
  LIMIT 1;

  IF v_user_id IS NULL THEN
    success := false; tipo := NULL; nombre_empleado := NULL;
    error_msg := 'PIN incorrecto'; RETURN NEXT; RETURN;
  END IF;

  -- ── Find employee + fichaje_mode ──────────────────────────────────────────
  SELECT e.id, COALESCE(e.fichaje_mode, 'any')
  INTO v_empleado_id, v_fichaje_mode
  FROM empleados e
  WHERE e.user_id = v_user_id
  LIMIT 1;

  nombre_empleado := v_nombre;

  -- ── Validate device against employee mode ─────────────────────────────────
  IF v_fichaje_mode = 'any' THEN
    -- No restriction — check kiosk device only to update last_seen_at
    IF p_device_key IS NOT NULL THEN
      SELECT id INTO v_device_id FROM kiosk_devices
        WHERE device_key = p_device_key AND is_active = true LIMIT 1;
      IF v_device_id IS NOT NULL THEN v_is_kiosk := true; END IF;
      -- For 'any' mode, a device_key that doesn't match a kiosk is still allowed
      -- (could be a corporate device or personal phone)
    END IF;

  ELSIF v_fichaje_mode = 'kiosk_only' THEN
    -- Must come from an active kiosk device
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
    -- Must come from active kiosk OR active corporate device assigned to this employee
    IF p_device_key IS NULL THEN
      success := false; tipo := NULL; nombre_empleado := v_nombre;
      error_msg := 'DEVICE_NOT_AUTHORIZED'; RETURN NEXT; RETURN;
    END IF;
    -- Check kiosk
    SELECT id INTO v_device_id FROM kiosk_devices
      WHERE device_key = p_device_key AND is_active = true LIMIT 1;
    IF v_device_id IS NOT NULL THEN
      v_is_kiosk := true;
    ELSE
      -- Check corporate device assigned to this employee
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

  -- ── Determine next event type ─────────────────────────────────────────────
  SELECT f.tipo_evento INTO v_last_event
  FROM fichajes f
  WHERE f.nombre_empleado = v_nombre AND f.fecha = v_today
  ORDER BY f.timestamp DESC LIMIT 1;

  IF v_last_event = 'entrada' THEN v_next_tipo := 'salida';
  ELSE v_next_tipo := 'entrada'; END IF;
  tipo := v_next_tipo;

  -- ── Insert fichaje ────────────────────────────────────────────────────────
  INSERT INTO fichajes (
    empleado_id, nombre_empleado, fecha, timestamp, tipo_evento,
    metodo, user_agent, dispositivo, es_manual, latitud, longitud, ubicacion,
    kiosk_device_id
  ) VALUES (
    v_empleado_id, v_nombre, v_today, now(), v_next_tipo,
    'pin', p_user_agent,
    COALESCE(p_dispositivo, p_device_key),
    false, p_latitud, p_longitud, p_ubicacion,
    CASE WHEN v_is_kiosk THEN v_device_id ELSE NULL END
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

GRANT EXECUTE ON FUNCTION public.kiosk_register_fichaje(text, double precision, double precision, text, text, text, text) TO anon, authenticated;
