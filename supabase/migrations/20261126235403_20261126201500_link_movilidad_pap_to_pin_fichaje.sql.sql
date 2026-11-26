/*
# Conectar Movilidad PAP con el fichaje rápido

1. Objetivo
- Hacer que el interruptor individual `user_profiles.movilidad_pap` sea la
  fuente de verdad para los botones Inicio Domicilio y Fin Domicilio del
  Registro de Jornada por PIN.

2. Función modificada
- `validate_vehicle_pin_with_mobility(text)` mantiene la misma respuesta
  pública y el mismo formato de identidad, pero `movilidad_enabled` ahora
  refleja directamente el interruptor del usuario validado.
- `register_fichaje_domicilio_with_pin(...)` ya utiliza ese resultado para
  impedir registros cuando Movilidad PAP está desactivada.

3. Seguridad
- La comprobación se hace en la base de datos después de resolver el PIN.
- La interfaz no puede conceder movilidad cambiando el estado visual del
  interruptor.
- No se modifican Entrada, Salida, Permiso, vehículos ni incidencias.

4. Compatibilidad
- Se conserva la firma de la función y el flujo de GPS existente.
- Los perfiles comienzan con el interruptor desactivado hasta que se active
  individualmente desde la nueva pestaña Movilidad PAP.
*/

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
    COALESCE(up.movilidad_pap, false) AS movilidad_enabled
  FROM public.user_profiles up
  LEFT JOIN public.empleados e ON e.user_id = up.id
  WHERE up.pin = p_pin
    AND up.activo = true
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.validate_vehicle_pin_with_mobility(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_vehicle_pin_with_mobility(text) TO anon, authenticated;