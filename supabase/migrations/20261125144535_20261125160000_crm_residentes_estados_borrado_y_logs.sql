/*
# CRM: estados de residentes, borrado protegido y logs de administración

## Resumen
Añade una papelera lógica para residentes del CRM. Un residente no se elimina
físicamente: se marca como borrado, conserva sus datos y puede aparecer en la
pestaña "Borrados" sin destruir notas, documentos, contactos ni tratamientos.

## 1. Cambios en `usuarios_servicios`
- `borrado_at` (timestamptz nullable): momento en que se envió a la papelera.
- `borrado_por` (uuid nullable): usuario autenticado que realizó la acción.
- `activo` continúa siendo el estado operativo para separar Activos e Inactivos.

## 2. Nuevas operaciones protegidas
- `crm_toggle_residente_activo(uuid, boolean)`: activa o desactiva un residente
  no borrado. Solo pueden usarla perfiles admin, RRHH, prevención, supervisor
  y coordinador (incluidas sus variantes Gerontalia) y únicamente sobre un
  residente que pueden ver.
- `crm_borrar_residente(uuid, text)`: envía un residente a la papelera. Exige
  que el PIN coincida con el usuario autenticado y que ese usuario tenga uno de
  los perfiles autorizados. La comprobación se hace en el servidor.
- Ambas operaciones escriben un registro en `audit_logs` con la persona, fecha,
  residente y acción realizada.
- `get_crm_residente_logs()`: devuelve los registros de residentes y solo puede
  ejecutarlo un administrador.

## 3. Seguridad y conservación de datos
- El borrado físico directo de `usuarios_servicios` queda bloqueado para
  `authenticated`; la única vía de borrado desde CRM es la papelera protegida.
- Las columnas `activo`, `borrado_at` y `borrado_por` no son editables
  directamente por el navegador; se modifican mediante las funciones protegidas.
- Las funciones usan `auth.uid()`, `SECURITY DEFINER` y `search_path` fijo.
- Las funciones se exponen únicamente a usuarios autenticados.
- No se eliminan filas ni se destruyen datos existentes.
*/

ALTER TABLE public.usuarios_servicios
  ADD COLUMN IF NOT EXISTS borrado_at timestamptz,
  ADD COLUMN IF NOT EXISTS borrado_por uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_servicios_borrado_at
  ON public.usuarios_servicios(borrado_at);

CREATE OR REPLACE FUNCTION public.crm_puede_gestionar_residente()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT EXISTS (
  SELECT 1
  FROM public.user_profiles up
  WHERE up.id = auth.uid()
    AND up.activo = true
    AND (
      up.role IN (
        'admin', 'rrhh', 'prevencion', 'supervisor', 'coordinador',
        'rrhh_gerontalia', 'administrador_gerontalia',
        'supervisor_gerontalia', 'prevencion_gerontalia'
      )
      OR up.roles && ARRAY[
        'admin', 'rrhh', 'prevencion', 'supervisor', 'coordinador',
        'rrhh_gerontalia', 'administrador_gerontalia',
        'supervisor_gerontalia', 'prevencion_gerontalia'
      ]::text[]
    )
);
$$;

REVOKE EXECUTE ON FUNCTION public.crm_puede_gestionar_residente() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_puede_gestionar_residente() TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_toggle_residente_activo(
  p_residente_id uuid,
  p_activo boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile record;
  v_residente record;
BEGIN
  SELECT up.id, up.nombre, up.email
  INTO v_profile
  FROM public.user_profiles up
  WHERE up.id = auth.uid()
    AND up.activo = true
    AND (
      up.role IN (
        'admin', 'rrhh', 'prevencion', 'supervisor', 'coordinador',
        'rrhh_gerontalia', 'administrador_gerontalia',
        'supervisor_gerontalia', 'prevencion_gerontalia'
      )
      OR up.roles && ARRAY[
        'admin', 'rrhh', 'prevencion', 'supervisor', 'coordinador',
        'rrhh_gerontalia', 'administrador_gerontalia',
        'supervisor_gerontalia', 'prevencion_gerontalia'
      ]::text[]
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  IF NOT public.crm_puede_ver_residente(p_residente_id) THEN
    RAISE EXCEPTION 'RESIDENT_NOT_VISIBLE';
  END IF;

  SELECT us.id, us.nombre, us.apellidos, us.activo, us.borrado_at
  INTO v_residente
  FROM public.usuarios_servicios us
  WHERE us.id = p_residente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESIDENT_NOT_FOUND';
  END IF;

  IF v_residente.borrado_at IS NOT NULL THEN
    RAISE EXCEPTION 'RESIDENT_DELETED';
  END IF;

  UPDATE public.usuarios_servicios
  SET activo = p_activo, updated_at = now()
  WHERE id = p_residente_id;

  INSERT INTO public.audit_logs (
    evento, descripcion, autor_id, autor_nombre, autor_email,
    entidad, entidad_id, metadata
  ) VALUES (
    'residente_status_changed',
    CASE WHEN p_activo THEN 'Residente activado' ELSE 'Residente marcado como inactivo' END,
    auth.uid(),
    v_profile.nombre,
    COALESCE(v_profile.email, ''),
    'usuarios_servicios',
    p_residente_id::text,
    jsonb_build_object(
      'residente_nombre', concat_ws(' ', v_residente.nombre, v_residente.apellidos),
      'activo', p_activo
    )
  );

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_toggle_residente_activo(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_toggle_residente_activo(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_borrar_residente(
  p_residente_id uuid,
  p_pin text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile record;
  v_residente record;
BEGIN
  IF p_pin IS NULL OR length(trim(p_pin)) = 0 THEN
    RAISE EXCEPTION 'PIN_REQUIRED';
  END IF;

  SELECT up.id, up.nombre, up.email
  INTO v_profile
  FROM public.user_profiles up
  WHERE up.id = auth.uid()
    AND up.activo = true
    AND up.pin = trim(p_pin)
    AND (
      up.role IN (
        'admin', 'rrhh', 'prevencion', 'supervisor', 'coordinador',
        'rrhh_gerontalia', 'administrador_gerontalia',
        'supervisor_gerontalia', 'prevencion_gerontalia'
      )
      OR up.roles && ARRAY[
        'admin', 'rrhh', 'prevencion', 'supervisor', 'coordinador',
        'rrhh_gerontalia', 'administrador_gerontalia',
        'supervisor_gerontalia', 'prevencion_gerontalia'
      ]::text[]
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PIN_INVALID';
  END IF;

  IF NOT public.crm_puede_ver_residente(p_residente_id) THEN
    RAISE EXCEPTION 'RESIDENT_NOT_VISIBLE';
  END IF;

  SELECT us.id, us.nombre, us.apellidos, us.borrado_at
  INTO v_residente
  FROM public.usuarios_servicios us
  WHERE us.id = p_residente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESIDENT_NOT_FOUND';
  END IF;

  IF v_residente.borrado_at IS NOT NULL THEN
    RAISE EXCEPTION 'RESIDENT_ALREADY_DELETED';
  END IF;

  UPDATE public.usuarios_servicios
  SET activo = false,
      borrado_at = now(),
      borrado_por = auth.uid(),
      updated_at = now()
  WHERE id = p_residente_id;

  INSERT INTO public.audit_logs (
    evento, descripcion, autor_id, autor_nombre, autor_email,
    entidad, entidad_id, metadata
  ) VALUES (
    'residente_deleted',
    'Residente enviado a la papelera del CRM',
    auth.uid(),
    v_profile.nombre,
    COALESCE(v_profile.email, ''),
    'usuarios_servicios',
    p_residente_id::text,
    jsonb_build_object(
      'residente_nombre', concat_ws(' ', v_residente.nombre, v_residente.apellidos),
      'borrado_logico', true
    )
  );

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_borrar_residente(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_borrar_residente(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_crm_residente_logs()
RETURNS TABLE (
  id uuid,
  evento text,
  descripcion text,
  autor_nombre text,
  autor_email text,
  entidad_id text,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.activo = true
      AND (
        up.role = 'admin'
        OR up.roles && ARRAY['admin']::text[]
      )
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  RETURN QUERY
  SELECT l.id, l.evento, l.descripcion, l.autor_nombre, l.autor_email,
    l.entidad_id, l.metadata, l.created_at
  FROM public.audit_logs l
  WHERE l.entidad = 'usuarios_servicios'
    AND l.evento IN ('residente_deleted', 'residente_status_changed')
  ORDER BY l.created_at DESC
  LIMIT 500;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_crm_residente_logs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_crm_residente_logs() TO authenticated;

REVOKE UPDATE ON public.usuarios_servicios FROM authenticated;
GRANT UPDATE (
  nombre, apellidos, email, telefono, observaciones, updated_at,
  tipo_identificacion, identificacion, genero, tipo_direccion, direccion,
  localidad, provincia, codigo_postal, pais, fecha_nacimiento, estado_civil,
  foto_url, acronimo
) ON public.usuarios_servicios TO authenticated;
REVOKE DELETE ON public.usuarios_servicios FROM authenticated;
