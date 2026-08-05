/*
# Sistema de control de dispositivos de kiosco (tablets autorizadas)

## Descripción
Implementa el sistema de autorización de tablets para el control de fichajes multisede.

## Cambios

### 1. Nueva tabla: `kiosk_devices`
Registra cada tablet autorizada para realizar fichajes.
- `id` — UUID primario
- `device_key` — Código único de la tablet (guardado en su localStorage), ej: 'tablet_oficina_bcn_1'
- `site_name` — Nombre del centro/sede, ej: 'Oficina Barcelona'
- `is_active` — Si la tablet está habilitada (false = bloqueada, no puede fichar)
- `notes` — Notas opcionales (modelo, ubicación física, etc.)
- `created_at` — Fecha de registro
- `last_seen_at` — Última vez que esta tablet registró un fichaje (auto-actualizada)

### 2. Columna adicional en `fichajes`
- `kiosk_device_id` (uuid, nullable) — FK a `kiosk_devices.id`, indica desde qué tablet exacta se fichó

### 3. Actualización de `kiosk_register_fichaje`
La función ahora acepta un nuevo parámetro `p_device_key` (text).
- Si `p_device_key` NO es NULL: valida que exista en `kiosk_devices` con `is_active = true`.
  Si no existe o está inactivo, devuelve error_msg = 'DEVICE_NOT_AUTHORIZED' y success = false.
- Si `p_device_key` IS NULL: permite el fichaje (modo legacy / sin restricción de dispositivo).
- Guarda el `kiosk_device_id` en el registro de fichaje.
- Actualiza `last_seen_at` en `kiosk_devices` al registrar un fichaje exitoso.

### 4. RLS
- `kiosk_devices`: anon + authenticated pueden SELECT (necesario para validar device_key desde el kiosco).
  Solo authenticated puede INSERT/UPDATE/DELETE (gestión por admins).
- `fichajes.kiosk_device_id`: no requiere políticas adicionales, la columna hereda las de la tabla.

### Notas
- La columna `kiosk_device_id` es nullable para no romper fichajes históricos ni fichajes manuales.
- El `device_key` se genera en el frontend y se guarda en `localStorage` de la tablet.
*/

-- ── 1. Tabla kiosk_devices ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kiosk_devices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_key    text UNIQUE NOT NULL,
  site_name     text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz
);

ALTER TABLE kiosk_devices ENABLE ROW LEVEL SECURITY;

-- Anyone (anon kiosk) can validate their own device_key
DROP POLICY IF EXISTS "kiosk_devices_select" ON kiosk_devices;
CREATE POLICY "kiosk_devices_select" ON kiosk_devices FOR SELECT
  TO anon, authenticated USING (true);

-- Only authenticated admins can manage devices
DROP POLICY IF EXISTS "kiosk_devices_insert" ON kiosk_devices;
CREATE POLICY "kiosk_devices_insert" ON kiosk_devices FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "kiosk_devices_update" ON kiosk_devices;
CREATE POLICY "kiosk_devices_update" ON kiosk_devices FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "kiosk_devices_delete" ON kiosk_devices;
CREATE POLICY "kiosk_devices_delete" ON kiosk_devices FOR DELETE
  TO authenticated USING (true);

-- ── 2. Columna device_id en fichajes ─────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fichajes' AND column_name = 'kiosk_device_id'
  ) THEN
    ALTER TABLE fichajes ADD COLUMN kiosk_device_id uuid REFERENCES kiosk_devices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 3. Actualización de kiosk_register_fichaje ───────────────────────────────

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
  v_user_id       uuid;
  v_nombre        text;
  v_empleado_id   uuid;
  v_today         date := current_date;
  v_last_event    text;
  v_next_tipo     text;
  v_device_id     uuid;
BEGIN
  -- ── Validate kiosk device (if a device_key was provided) ─────────────────
  IF p_device_key IS NOT NULL THEN
    SELECT id INTO v_device_id
    FROM kiosk_devices
    WHERE device_key = p_device_key
      AND is_active = true
    LIMIT 1;

    IF v_device_id IS NULL THEN
      success := false;
      tipo := NULL;
      nombre_empleado := NULL;
      error_msg := 'DEVICE_NOT_AUTHORIZED';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- ── Validate PIN ──────────────────────────────────────────────────────────
  SELECT vp.id, vp.nombre INTO v_user_id, v_nombre
  FROM validate_vehicle_pin(p_pin) vp
  LIMIT 1;

  IF v_user_id IS NULL THEN
    success := false;
    tipo := NULL;
    nombre_empleado := NULL;
    error_msg := 'PIN incorrecto';
    RETURN NEXT;
    RETURN;
  END IF;

  -- ── Find employee record ──────────────────────────────────────────────────
  SELECT e.id INTO v_empleado_id
  FROM empleados e
  WHERE e.user_id = v_user_id
  LIMIT 1;

  nombre_empleado := v_nombre;

  -- ── Lock today's rows to prevent race conditions ──────────────────────────
  PERFORM 1 FROM fichajes f
  WHERE f.nombre_empleado = v_nombre
    AND f.fecha = v_today
  FOR UPDATE;

  -- ── Determine next event type ─────────────────────────────────────────────
  SELECT f.tipo_evento INTO v_last_event
  FROM fichajes f
  WHERE f.nombre_empleado = v_nombre
    AND f.fecha = v_today
  ORDER BY f.timestamp DESC
  LIMIT 1;

  IF v_last_event = 'entrada' THEN
    v_next_tipo := 'salida';
  ELSE
    v_next_tipo := 'entrada';
  END IF;

  tipo := v_next_tipo;

  -- ── Insert fichaje ────────────────────────────────────────────────────────
  INSERT INTO fichajes (
    empleado_id,
    nombre_empleado,
    fecha,
    timestamp,
    tipo_evento,
    metodo,
    user_agent,
    dispositivo,
    es_manual,
    latitud,
    longitud,
    ubicacion,
    kiosk_device_id
  ) VALUES (
    v_empleado_id,
    v_nombre,
    v_today,
    now(),
    v_next_tipo,
    'pin',
    p_user_agent,
    p_dispositivo,
    false,
    p_latitud,
    p_longitud,
    p_ubicacion,
    v_device_id
  );

  -- ── Update device last_seen_at ────────────────────────────────────────────
  IF v_device_id IS NOT NULL THEN
    UPDATE kiosk_devices SET last_seen_at = now() WHERE id = v_device_id;
  END IF;

  success := true;
  error_msg := NULL;
  RETURN NEXT;
END;
$$;

-- Revoke old signature and grant new one
REVOKE ALL ON FUNCTION public.kiosk_register_fichaje(text, double precision, double precision, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_register_fichaje(text, double precision, double precision, text, text, text, text) TO anon, authenticated;
