/*
# Añadir interruptor individual de Movilidad PAP

1. Objetivo
- Añadir un interruptor independiente por usuario para activar o desactivar
  Movilidad PAP desde Control de dispositivos de fichaje.
- La opción se mostrará junto a la pestaña Telemetría con el nombre exacto
  "Movilidad PAP".
- Todos los usuarios comienzan desactivados para conservar el comportamiento
  actual hasta que un administrador o RRHH los active expresamente.

2. Tabla modificada
- `user_profiles`
- Nueva columna `movilidad_pap` (boolean, obligatoria, valor inicial false).
  Guarda exclusivamente si ese usuario tiene habilitada la movilidad PAP.
  No modifica `role`, `roles`, `fichaje_mode` ni ningún permiso existente.

3. Funciones protegidas
- `get_movilidad_pap_users()` devuelve únicamente los datos necesarios para
  pintar la lista: id, nombre, email, activo y estado del interruptor.
- `set_movilidad_pap(uuid, boolean)` cambia solo el interruptor del usuario
  indicado y devuelve el nuevo estado.
- Ambas funciones requieren una sesión autenticada con permisos de admin o
  RRHH. El id del usuario objetivo no concede permisos al llamante.

4. Seguridad
- La columna no se modifica directamente desde el navegador.
- Las funciones usan SECURITY DEFINER y search_path fijo.
- Se revoca la ejecución pública y se concede únicamente a authenticated.
- No se concede acceso a anon porque esta gestión pertenece al panel interno.

5. Compatibilidad
- El valor inicial false no altera fichajes, dispositivos, telemetría ni
  permisos de pestañas existentes.
- La migración es idempotente y no elimina ni cambia datos existentes.
*/

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS movilidad_pap boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_movilidad_pap_users()
RETURNS TABLE(
  id uuid,
  nombre text,
  email text,
  activo boolean,
  movilidad_pap boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    up.id,
    up.nombre,
    up.email,
    up.activo,
    up.movilidad_pap
  FROM public.user_profiles up
  WHERE public.is_admin_or_rrhh()
  ORDER BY up.nombre, up.email;
$function$;

CREATE OR REPLACE FUNCTION public.set_movilidad_pap(
  p_user_id uuid,
  p_enabled boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_enabled boolean;
BEGIN
  IF NOT public.is_admin_or_rrhh() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  UPDATE public.user_profiles
  SET movilidad_pap = COALESCE(p_enabled, false),
      updated_at = now()
  WHERE id = p_user_id
  RETURNING movilidad_pap INTO v_enabled;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  RETURN v_enabled;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_movilidad_pap_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_movilidad_pap_users() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_movilidad_pap(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_movilidad_pap(uuid, boolean) TO authenticated;