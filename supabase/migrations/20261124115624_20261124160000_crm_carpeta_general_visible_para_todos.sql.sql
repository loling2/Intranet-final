/*
# Carpeta "General" de documentos del residente visible para todos los perfiles

1. Comportamiento
- Las carpetas de documentos de un residente creadas bajo la etiqueta de puesto "General"
  pasan a ser visibles para cualquier perfil con acceso al residente, igual que las carpetas
  generales (sin etiqueta de puesto).
- Antes solo las veían los empleados cuyo puesto fuera exactamente "General".
- No se modifica ni borra ninguna carpeta ni documento existente.

2. Seguridad
- Se reemplaza la función get_visible_crm_carpetas añadiendo una rama OR: la carpeta es
  visible si su etiqueta de puesto se llama "General" (sin distinguir mayúsculas).
- Sigue siendo SECURITY DEFINER con search_path fijo y ejecución solo para authenticated.
*/

CREATE OR REPLACE FUNCTION public.get_visible_crm_carpetas(p_usuario_servicio_id uuid)
RETURNS TABLE(id uuid, usuario_servicio_id uuid, categoria_id uuid, nombre text, wasabi_prefix text, categoria_nombre text, es_general boolean, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT
  car.id, car.usuario_servicio_id, car.categoria_id, car.nombre,
  car.wasabi_prefix,
  COALESCE(pt.nombre, 'General') AS categoria_nombre,
  (car.puesto_tag_id IS NULL OR LOWER(btrim(pt.nombre)) = 'general') AS es_general,
  car.created_at
FROM crm_carpetas car
LEFT JOIN puesto_tags pt ON pt.id = car.puesto_tag_id
WHERE car.usuario_servicio_id = p_usuario_servicio_id
AND crm_puede_ver_residente(p_usuario_servicio_id)
AND (
  is_admin_or_rrhh()
  OR car.puesto_tag_id IS NULL
  OR LOWER(btrim(pt.nombre)) = 'general'
  OR EXISTS (
    SELECT 1 FROM empleados e
    WHERE e.user_id = auth.uid() AND e.puesto_tag_id = car.puesto_tag_id
  )
)
ORDER BY (car.puesto_tag_id IS NULL OR LOWER(btrim(pt.nombre)) = 'general') DESC, categoria_nombre, car.nombre;
$$;

REVOKE EXECUTE ON FUNCTION public.get_visible_crm_carpetas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_visible_crm_carpetas(uuid) TO authenticated;
