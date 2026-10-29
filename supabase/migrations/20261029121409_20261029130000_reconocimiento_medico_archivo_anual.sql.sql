CREATE TABLE public.reconocimiento_medico_archivo_anual (
  anio integer NOT NULL,
  empleado_id uuid NOT NULL,
  nombre text,
  apellidos text,
  reconocimiento_medico text,
  reconocimiento_medico_estado text,
  reconocimiento_medico_realizado boolean,
  reconocimiento_medico_fecha date,
  archivado_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (anio, empleado_id)
);

ALTER TABLE public.reconocimiento_medico_archivo_anual ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.reconocimiento_medico_archivo_anual TO authenticated;

CREATE POLICY "select_reconocimiento_archivo_staff" ON public.reconocimiento_medico_archivo_anual
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = ANY (ARRAY['admin'::text, 'rrhh'::text]) AND up.activo = true
  ));

CREATE OR REPLACE FUNCTION public.reset_reconocimiento_medico_anual()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anio_archivado integer := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Madrid'))::integer - 1;
  v_count integer;
BEGIN
  INSERT INTO reconocimiento_medico_archivo_anual (
    anio, empleado_id, nombre, apellidos, reconocimiento_medico,
    reconocimiento_medico_estado, reconocimiento_medico_realizado, reconocimiento_medico_fecha
  )
  SELECT v_anio_archivado, e.id, e.nombre, e.apellidos, e.reconocimiento_medico,
         e.reconocimiento_medico_estado, e.reconocimiento_medico_realizado, e.reconocimiento_medico_fecha
  FROM empleados e
  ON CONFLICT (anio, empleado_id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    apellidos = EXCLUDED.apellidos,
    reconocimiento_medico = EXCLUDED.reconocimiento_medico,
    reconocimiento_medico_estado = EXCLUDED.reconocimiento_medico_estado,
    reconocimiento_medico_realizado = EXCLUDED.reconocimiento_medico_realizado,
    reconocimiento_medico_fecha = EXCLUDED.reconocimiento_medico_fecha,
    archivado_at = now();

  DELETE FROM reconocimiento_medico_archivo_anual WHERE anio < v_anio_archivado - 3;

  UPDATE empleados SET reconocimiento_medico = 'pendiente'
  WHERE reconocimiento_medico IS DISTINCT FROM 'pendiente';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_reconocimiento_medico_anual() FROM PUBLIC, anon, authenticated;
