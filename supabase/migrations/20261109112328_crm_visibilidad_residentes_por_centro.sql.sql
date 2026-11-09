/*
# CRM: visibilidad de residentes por centro asignado

## Resumen
Un trabajador o coordinador ve los residentes de los centros que tiene asignados
(tabla crm_usuario_centros), además de los residentes asignados a mano en
crm_paciente_asignaciones. Admin y RRHH siguen viendo todos.

## 1. Nueva función: crm_puede_ver_residente(usuario_servicio_id)
- Verdadero si el usuario es admin/rrhh, si tiene asignación manual al residente,
  o si el residente pertenece a alguno de sus centros asignados.

## 2. Funciones actualizadas
- get_my_crm_pacientes: lista los residentes que pasan crm_puede_ver_residente.
- get_visible_crm_carpetas: misma regla de visibilidad, más la carpeta de su puesto
  (o la General) para residentes visibles. Las carpetas por puesto sólo se muestran
  a quien tiene ese puesto.
- can_access_crm: también concede acceso a usuarios con centros asignados.

## Seguridad
- crm_puede_ver_residente no es invocable por anon ni PUBLIC.
- Funciones con los mismos parámetros y tipos de retorno; no se pierden datos.
- Idempotente: CREATE OR REPLACE.
*/

CREATE OR REPLACE FUNCTION public.crm_puede_ver_residente(p_usuario_servicio_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT
  is_admin_or_rrhh()
  OR EXISTS (
    SELECT 1 FROM public.crm_paciente_asignaciones a
    WHERE a.usuario_servicio_id = p_usuario_servicio_id
    AND a.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.usuarios_servicios_centros uc
    JOIN public.crm_usuario_centros ucc ON ucc.centro_id = uc.centro_id
    WHERE uc.usuario_servicio_id = p_usuario_servicio_id
    AND ucc.user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.crm_puede_ver_residente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_puede_ver_residente(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_crm_pacientes()
RETURNS TABLE(id uuid, nombre text, apellidos text, email text, telefono text, observaciones text, activo boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT
  us.id, us.nombre, us.apellidos, us.email, us.telefono,
  us.observaciones, us.activo
FROM usuarios_servicios us
WHERE crm_puede_ver_residente(us.id)
ORDER BY us.nombre, us.apellidos;
$$;

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
  (car.puesto_tag_id IS NULL) AS es_general,
  car.created_at
FROM crm_carpetas car
LEFT JOIN puesto_tags pt ON pt.id = car.puesto_tag_id
WHERE car.usuario_servicio_id = p_usuario_servicio_id
AND crm_puede_ver_residente(p_usuario_servicio_id)
AND (
  is_admin_or_rrhh()
  OR car.puesto_tag_id IS NULL
  OR EXISTS (
    SELECT 1 FROM empleados e
    WHERE e.user_id = auth.uid() AND e.puesto_tag_id = car.puesto_tag_id
  )
)
ORDER BY (car.puesto_tag_id IS NULL) DESC, categoria_nombre, car.nombre;
$$;

CREATE OR REPLACE FUNCTION public.can_access_crm()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT
EXISTS (
  SELECT 1 FROM public.user_profiles
  WHERE id = auth.uid()
  AND (
    role IN ('admin', 'rrhh', 'crm')
    OR 'crm' = ANY(COALESCE(roles, ARRAY[]::text[]))
  )
)
OR EXISTS (
  SELECT 1 FROM public.crm_paciente_asignaciones
  WHERE user_id = auth.uid()
)
OR EXISTS (
  SELECT 1 FROM public.crm_usuario_centros
  WHERE user_id = auth.uid()
);
$$;
