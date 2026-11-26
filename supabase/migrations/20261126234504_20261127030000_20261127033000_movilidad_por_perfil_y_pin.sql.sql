/*
# Movilidad controlada por perfil y disponible en Registro de Jornada

1. Purpose
Movilidad is an optional capability controlled from Ajustes > Permisos de
Perfiles. The Movilidad tab is enabled only for the `admin` profile by default;
an administrator can activate it for another profile from the existing profile
permissions screen. The quick PIN jornada menu uses the same profile permission:
workers whose profile has Movilidad enabled see Inicio Domicilio and Fin
domicilio, and workers without it do not see those actions.

2. Modified permissions
- `role_tab_permissions.tab_id = 'movilidad'`: existing rows for every role are
  kept but disabled, so previous broad defaults do not expose the tab or the
  mobile actions.
- `role_tab_permissions`: the `admin` profile is enabled by default.
- Existing profile-permission rows and all other modules are unchanged.

3. New functions
- `validate_vehicle_pin_with_mobility(p_pin)`: public PIN validation for the
  quick jornada flow. It returns the existing worker identity plus
  `movilidad_enabled`, calculated from the worker's primary role or roles array
  and the `movilidad` row in `role_tab_permissions`.
- `register_fichaje_domicilio_with_pin(...)`: public quick-jornada mutation.
  It validates the PIN, active worker, allowed event type, GPS coordinates and
  the Movilidad profile permission on the server, then creates a row in
  `fichajes_domicilios` using the identity resolved from the PIN. The browser
  cannot choose another employee or bypass the permission by editing the UI.

4. Security
- Both functions use SECURITY DEFINER with a fixed public search path.
- The functions receive only a PIN and event data; user and employee identity
  always come from the database lookup.
- GPS latitude and longitude are required and checked for valid geographic
  ranges.
- The mutation returns a generic permission error when Movilidad is disabled.
- EXECUTE is granted to anon and authenticated because Registro de Jornada is a
  PIN-based flow without a login session; PUBLIC execution is revoked first.

5. Compatibility
- Existing `validate_vehicle_pin`, `web_register_fichaje`, `fichajes` rows and
  jornada Entrada/Salida behavior are not changed.
- Existing `fichajes_domicilios` storage and RLS remain in place. This migration
  only adds the secure PIN path and corrects default profile permissions.
*/

-- ── 1. Movilidad defaults: admin only ────────────────────────────────────────
UPDATE public.role_tab_permissions
SET enabled = false,
    updated_at = now()
WHERE tab_id = 'movilidad'
  AND role <> 'admin';

INSERT INTO public.role_tab_permissions (role, tab_id, enabled)
VALUES ('admin', 'movilidad', true)
ON CONFLICT (role, tab_id)
DO UPDATE SET enabled = true, updated_at = now();

-- ── 2. PIN validation with the profile capability ────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_vehicle_pin_with_mobility(p_pin text)
RETURNS TABLE(
  id uuid,
  nombre text,
  empleado_id uuid,
  fichaje_mode text,
  movilidad_enabled boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    up.id,
    up.nombre,
    e.id AS empleado_id,
    COALESCE(e.fichaje_mode, 'kiosk_only') AS fichaje_mode,
    EXISTS (
      SELECT 1
      FROM public.role_tab_permissions rtp
      WHERE rtp.tab_id = 'movilidad'
        AND rtp.enabled = true
        AND (
          rtp.role = up.role
          OR rtp.role = ANY(COALESCE(up.roles, '{}'::text[]))
        )
    ) AS movilidad_enabled
  FROM public.user_profiles up
  LEFT JOIN public.empleados e ON e.user_id = up.id
  WHERE up.pin = p_pin
    AND up.activo = true
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.validate_vehicle_pin_with_mobility(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_vehicle_pin_with_mobility(text) TO anon, authenticated;

-- ── 3. Secure quick-jornada domicile mutation ────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_fichaje_domicilio_with_pin(
  p_tipo_evento text,
  p_latitud double precision,
  p_longitud double precision,
  p_ubicacion text DEFAULT NULL,
  p_dispositivo text DEFAULT NULL,
  p_pin text DEFAULT NULL
)
RETURNS TABLE(success boolean, tipo text, nombre_empleado text, error_msg text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_empleado_id uuid;
  v_nombre text;
  v_movilidad_enabled boolean;
BEGIN
  IF p_tipo_evento NOT IN ('inicio_domicilio', 'fin_domicilio') THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'TIPO_EVENTO_INVALIDO';
    RETURN;
  END IF;

  IF p_latitud IS NULL OR p_longitud IS NULL
     OR p_latitud < -90 OR p_latitud > 90
     OR p_longitud < -180 OR p_longitud > 180 THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'LOCATION_REQUIRED';
    RETURN;
  END IF;

  SELECT v.id, v.nombre, v.empleado_id, v.movilidad_enabled
  INTO v_user_id, v_nombre, v_empleado_id, v_movilidad_enabled
  FROM public.validate_vehicle_pin_with_mobility(p_pin) v
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, 'PIN_INCORRECTO';
    RETURN;
  END IF;

  IF v_empleado_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, v_nombre, 'EMPLEADO_NO_ENCONTRADO';
    RETURN;
  END IF;

  IF NOT COALESCE(v_movilidad_enabled, false) THEN
    RETURN QUERY SELECT false, NULL::text, v_nombre, 'MOVILIDAD_NO_AUTORIZADA';
    RETURN;
  END IF;

  INSERT INTO public.fichajes_domicilios (
    empleado_id,
    user_id,
    fecha,
    "timestamp",
    tipo_evento,
    latitud,
    longitud,
    ubicacion,
    dispositivo
  ) VALUES (
    v_empleado_id,
    v_user_id,
    current_date,
    now(),
    p_tipo_evento,
    p_latitud,
    p_longitud,
    p_ubicacion,
    p_dispositivo
  );

  RETURN QUERY SELECT true, p_tipo_evento, v_nombre, NULL::text;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.register_fichaje_domicilio_with_pin(text, double precision, double precision, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_fichaje_domicilio_with_pin(text, double precision, double precision, text, text, text) TO anon, authenticated;