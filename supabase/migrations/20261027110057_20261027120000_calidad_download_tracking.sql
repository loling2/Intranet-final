/*
# Seguimiento de descargas de documentos de Calidad

1. Objetivo
- Registrar de forma persistente cuándo cada empleado descarga un documento de Calidad.
- Permitir al perfil Calidad consultar, por documento, quién lo ha descargado y quién sigue pendiente.
- Mantener el dato de descarga en el servidor para que no dependa de la interfaz del navegador.

2. Nueva tabla: calidad_download_logs
- `id`: identificador único del registro.
- `document_id`: documento de Calidad descargado.
- `user_id`: cuenta autenticada que realizó la descarga.
- `empleado_id`: empleado asociado a la cuenta.
- `downloaded_at`: fecha y hora de la última descarga registrada.
- Se impide duplicar el par documento-empleado; una nueva descarga actualiza la fecha.

3. Seguridad
- RLS habilitado en la nueva tabla.
- Los empleados no insertan directamente registros ni pueden elegir el usuario que aparece como descargador.
- La anotación se realiza mediante una función protegida que obtiene el usuario desde `auth.uid()` y valida que el documento sea visible para ese empleado.
- Calidad y administración consultan el informe mediante una función protegida.
- Se revoca el acceso público a las funciones y se concede únicamente a usuarios autenticados.

4. Compatibilidad
- No se modifican ni eliminan columnas o datos existentes.
- Los documentos generales se consideran dirigidos a todos los empleados activos con cuenta.
- Los documentos por sociedad se consideran dirigidos a los empleados activos de las sociedades indicadas.
*/

CREATE TABLE IF NOT EXISTS public.calidad_download_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.calidad_documentos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empleado_id uuid NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  downloaded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calidad_download_logs_document_employee_key UNIQUE (document_id, empleado_id)
);

CREATE INDEX IF NOT EXISTS idx_calidad_download_logs_document
  ON public.calidad_download_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_calidad_download_logs_employee
  ON public.calidad_download_logs(empleado_id);

ALTER TABLE public.calidad_download_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.calidad_download_logs TO authenticated;

DROP POLICY IF EXISTS "employees_select_own_calidad_download" ON public.calidad_download_logs;
CREATE POLICY "employees_select_own_calidad_download"
  ON public.calidad_download_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "quality_select_calidad_download" ON public.calidad_download_logs;
CREATE POLICY "quality_select_calidad_download"
  ON public.calidad_download_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.activo = true
        AND (
          up.role IN ('admin', 'calidad')
          OR 'calidad' = ANY (COALESCE(up.roles, ARRAY[]::text[]))
        )
    )
  );

CREATE OR REPLACE FUNCTION public.log_calidad_download(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empleado_id uuid;
BEGIN
  SELECT e.id
  INTO v_empleado_id
  FROM public.empleados e
  JOIN public.calidad_documentos d ON d.id = p_document_id
  WHERE e.user_id = auth.uid()
    AND e.activo = true
    AND (
      d.es_general = true
      OR d.sociedad_ids = '{}'
      OR e.id_sociedad::text = ANY (d.sociedad_ids)
    )
  LIMIT 1;

  IF v_empleado_id IS NULL THEN
    RAISE EXCEPTION 'Documento no disponible';
  END IF;

  INSERT INTO public.calidad_download_logs (document_id, user_id, empleado_id, downloaded_at)
  VALUES (p_document_id, auth.uid(), v_empleado_id, now())
  ON CONFLICT (document_id, empleado_id)
  DO UPDATE SET downloaded_at = EXCLUDED.downloaded_at, user_id = EXCLUDED.user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_calidad_download(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_calidad_download(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_calidad_document_trazabilidad(p_document_id uuid)
RETURNS TABLE (
  empleado_id uuid,
  nombre text,
  email text,
  society_id uuid,
  society_nombre text,
  downloaded boolean,
  downloaded_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.activo = true
      AND (
        up.role IN ('admin', 'calidad')
        OR 'calidad' = ANY (COALESCE(up.roles, ARRAY[]::text[]))
      )
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.nombre,
    e.email,
    s.id,
    s.nombre,
    (l.id IS NOT NULL),
    l.downloaded_at
  FROM public.empleados e
  LEFT JOIN public.sociedades s ON s.id = e.id_sociedad
  JOIN public.calidad_documentos d ON d.id = p_document_id
  LEFT JOIN public.calidad_download_logs l
    ON l.document_id = d.id
   AND l.empleado_id = e.id
  WHERE e.activo = true
    AND e.user_id IS NOT NULL
    AND (
      d.es_general = true
      OR d.sociedad_ids = '{}'
      OR e.id_sociedad::text = ANY (d.sociedad_ids)
    )
  ORDER BY (l.id IS NOT NULL) DESC, e.nombre;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_calidad_document_trazabilidad(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_calidad_document_trazabilidad(uuid) TO authenticated;