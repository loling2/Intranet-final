/*
# Carpetas por puesto de trabajo en Documentos del residente

1. Comportamiento
- Cada residente tiene una carpeta por cada puesto de trabajo existente en la base de datos.
- Al crear un residente se crean automáticamente sus carpetas de puesto.
- Al crear un puesto nuevo se añade su carpeta a todos los residentes existentes.
- Se rellenan las carpetas que falten en residentes ya existentes.

2. Datos
- Se usa la tabla crm_carpetas, con puesto_tag_id y el mismo formato de ruta de almacenamiento que las carpetas creadas a mano.
- No se borra ni modifica ninguna carpeta existente. Las carpetas repetidas (mismo residente y puesto) no se duplican.

3. Seguridad
- Las funciones solo son ejecutadas por el sistema mediante disparadores; no se conceden permisos a los usuarios.
*/

CREATE OR REPLACE FUNCTION public.crm_nombre_carpeta_puesto(p_nombre text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT btrim(regexp_replace(p_nombre, '[^a-zA-Z0-9ÁáÉéÍíÓóÚúÑñ._ -]', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.crm_crear_carpetas_puestos_residente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.crm_carpetas (usuario_servicio_id, puesto_tag_id, nombre, wasabi_prefix)
  SELECT NEW.id, pt.id, public.crm_nombre_carpeta_puesto(pt.nombre),
         'crm/documentacion/' || NEW.id || '/' || public.crm_nombre_carpeta_puesto(pt.nombre) || '/'
  FROM public.puesto_tags pt
  WHERE public.crm_nombre_carpeta_puesto(pt.nombre) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.crm_carpetas c
      WHERE c.usuario_servicio_id = NEW.id AND c.puesto_tag_id = pt.id
    );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_crear_carpetas_puesto_nuevo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.crm_carpetas (usuario_servicio_id, puesto_tag_id, nombre, wasabi_prefix)
  SELECT us.id, NEW.id, public.crm_nombre_carpeta_puesto(NEW.nombre),
         'crm/documentacion/' || us.id || '/' || public.crm_nombre_carpeta_puesto(NEW.nombre) || '/'
  FROM public.usuarios_servicios us
  WHERE public.crm_nombre_carpeta_puesto(NEW.nombre) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.crm_carpetas c
      WHERE c.usuario_servicio_id = us.id AND c.puesto_tag_id = NEW.id
    );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_crear_carpetas_puestos_residente() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_crear_carpetas_puesto_nuevo() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_crm_carpetas_puestos_residente ON usuarios_servicios;
CREATE TRIGGER trg_crm_carpetas_puestos_residente
  AFTER INSERT ON usuarios_servicios
  FOR EACH ROW EXECUTE FUNCTION public.crm_crear_carpetas_puestos_residente();

DROP TRIGGER IF EXISTS trg_crm_carpetas_puesto_nuevo ON puesto_tags;
CREATE TRIGGER trg_crm_carpetas_puesto_nuevo
  AFTER INSERT ON puesto_tags
  FOR EACH ROW EXECUTE FUNCTION public.crm_crear_carpetas_puesto_nuevo();

INSERT INTO crm_carpetas (usuario_servicio_id, puesto_tag_id, nombre, wasabi_prefix)
SELECT us.id, pt.id, public.crm_nombre_carpeta_puesto(pt.nombre),
       'crm/documentacion/' || us.id || '/' || public.crm_nombre_carpeta_puesto(pt.nombre) || '/'
FROM usuarios_servicios us
CROSS JOIN puesto_tags pt
WHERE public.crm_nombre_carpeta_puesto(pt.nombre) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM crm_carpetas c
    WHERE c.usuario_servicio_id = us.id AND c.puesto_tag_id = pt.id
  );
