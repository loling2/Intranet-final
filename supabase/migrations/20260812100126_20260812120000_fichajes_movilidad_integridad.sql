/*
# Movilidad e integridad de fichajes

1. Nuevas columnas en `fichajes`
- `centro_id`: centro donde se realizó el fichaje, aunque sea distinto al centro habitual del trabajador.
- `centro_nombre`: copia visible del centro registrado para conservar el contexto histórico si se renombra posteriormente.

2. Integridad temporal
- Cada alta de fichaje recibe `clock_timestamp()` del servidor.
- El timestamp no puede cambiarse mediante actualizaciones posteriores.

3. Seguridad y compatibilidad
- Se mantiene la compatibilidad con fichajes históricos y tablets ya autorizadas.
- El centro se resuelve desde `kiosk_devices.site_name` cuando el fichaje procede de una tablet.
*/

ALTER TABLE public.fichajes
  ADD COLUMN IF NOT EXISTS centro_id uuid REFERENCES public.centros(id) ON DELETE SET NULL;
ALTER TABLE public.fichajes
  ADD COLUMN IF NOT EXISTS centro_nombre text;

CREATE INDEX IF NOT EXISTS idx_fichajes_centro_id ON public.fichajes(centro_id);
CREATE INDEX IF NOT EXISTS idx_fichajes_fecha_centro ON public.fichajes(fecha, centro_id);

CREATE OR REPLACE FUNCTION public.protect_fichaje_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.timestamp := clock_timestamp();
  ELSE
    NEW.timestamp := OLD.timestamp;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fichajes_server_timestamp ON public.fichajes;
CREATE TRIGGER fichajes_server_timestamp
BEFORE INSERT OR UPDATE ON public.fichajes
FOR EACH ROW EXECUTE FUNCTION public.protect_fichaje_timestamp();

CREATE OR REPLACE FUNCTION public.kiosk_register_fichaje(
  p_pin text,
  p_latitud double precision DEFAULT NULL,
  p_longitud double precision DEFAULT NULL,
  p_ubicacion text DEFAULT NULL,
  p_dispositivo text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_device_key text DEFAULT NULL
)
RETURNS TABLE(success boolean, tipo text, nombre_empleado text, error_msg text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_nombre text;
  v_empleado_id uuid;
  v_today date := current_date;
  v_last_event text;
  v_next_tipo text;
  v_device_id uuid;
  v_site_name text;
  v_centro_id uuid;
BEGIN
  IF p_device_key IS NOT NULL THEN
    SELECT id, site_name INTO v_device_id, v_site_name
    FROM kiosk_devices
    WHERE device_key = p_device_key AND is_active = true
    LIMIT 1;
    IF v_device_id IS NULL THEN
      RETURN QUERY SELECT false, NULL::text, NULL::text, 'DEVICE_NOT_AUTHORIZED';
      RETURN;
    END IF;
  END IF;

  SELECT vp.id, vp.nombre INTO v_user_id, v_nombre
  FROM validate_vehicle_pin(p_pin) vp LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'PIN incorrecto';
    RETURN;
  END IF;

  SELECT e.id INTO v_empleado_id FROM empleados e WHERE e.user_id = v_user_id LIMIT 1;
  IF v_site_name IS NOT NULL THEN
    SELECT c.id INTO v_centro_id FROM centros c
    WHERE lower(trim(c.nombre)) = lower(trim(v_site_name)) LIMIT 1;
  END IF;

  PERFORM 1 FROM fichajes f WHERE f.nombre_empleado = v_nombre AND f.fecha = v_today FOR UPDATE;
  SELECT f.tipo_evento INTO v_last_event FROM fichajes f
  WHERE f.nombre_empleado = v_nombre AND f.fecha = v_today
  ORDER BY f.timestamp DESC LIMIT 1;
  v_next_tipo := CASE WHEN v_last_event = 'entrada' THEN 'salida' ELSE 'entrada' END;

  INSERT INTO fichajes (empleado_id, nombre_empleado, fecha, tipo_evento, metodo, user_agent, dispositivo, es_manual, latitud, longitud, ubicacion, kiosk_device_id, centro_id, centro_nombre)
  VALUES (v_empleado_id, v_nombre, v_today, v_next_tipo, 'pin', p_user_agent, p_dispositivo, false, p_latitud, p_longitud, p_ubicacion, v_device_id, v_centro_id, v_site_name);

  IF v_device_id IS NOT NULL THEN UPDATE kiosk_devices SET last_seen_at = clock_timestamp() WHERE id = v_device_id; END IF;
  RETURN QUERY SELECT true, v_next_tipo, v_nombre, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.kiosk_register_fichaje(text, double precision, double precision, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_register_fichaje(text, double precision, double precision, text, text, text, text) TO anon, authenticated;

DROP POLICY IF EXISTS "admin_rrhh_select_fichajes" ON public.fichajes;
CREATE POLICY "admin_rrhh_select_fichajes" ON public.fichajes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','auditor','rrhh','supervisor')));
