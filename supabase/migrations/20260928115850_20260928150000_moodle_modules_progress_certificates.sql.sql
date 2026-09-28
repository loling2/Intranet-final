/*
# Moodle modular, progreso y desbloqueo de examen

## Objetivo
Convierte los cursos actuales en recorridos formativos por módulos. El personal
de Formación puede crear módulos y ordenar sus materiales; el empleado avanza
uno a uno y el examen queda bloqueado hasta completar el curso.

## Cambios
1. `moodle_cursos`
   - Añade `examen_id`, el examen asociado al curso.
2. `moodle_modulos`
   - Nuevos módulos ordenados dentro de cada curso.
3. `moodle_contenido`
   - Añade módulo, tipo diapositivas, duración mínima, obligatoriedad,
     visibilidad y si el recurso se puede descargar.
4. `moodle_asignaciones`
   - Añade `examen_desbloqueado` para reflejar el estado del recorrido.
5. `moodle_progreso`
   - Guarda inicio y finalización de cada recurso por empleado.
6. Funciones protegidas
   - Iniciar y completar contenido solo para el empleado asignado.
   - Impiden completar antes de la duración mínima y antes del contenido previo.
   - Recalculan el porcentaje y desbloquean el examen al llegar al 100%.

## Seguridad
- Todas las tablas nuevas tienen RLS habilitado.
- Los empleados solo pueden consultar su propio progreso y sus cursos asignados.
- Las mutaciones de progreso se realizan mediante funciones `SECURITY DEFINER`
  que comprueban `auth.uid()` y no aceptan el empleado como parámetro.
- Las funciones fijan `search_path`, no son accesibles para `anon` y validan
  la secuencia, la asignación y el tiempo mínimo.

## Compatibilidad
- Los contenidos existentes permanecen en el curso y se migran al módulo
  inicial de cada curso mediante el bloque de actualización final.
- No se borran tablas ni datos existentes.
*/

ALTER TABLE public.moodle_cursos
  ADD COLUMN IF NOT EXISTS examen_id uuid REFERENCES public.examenes(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.moodle_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES public.moodle_cursos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descripcion text,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moodle_modulos_curso_orden_idx
  ON public.moodle_modulos(curso_id, orden);

ALTER TABLE public.moodle_contenido
  ADD COLUMN IF NOT EXISTS modulo_id uuid REFERENCES public.moodle_modulos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS duracion_minutos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS es_obligatorio boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_empleado boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS descargable boolean NOT NULL DEFAULT true;

ALTER TABLE public.moodle_contenido DROP CONSTRAINT IF EXISTS moodle_contenido_tipo_check;
ALTER TABLE public.moodle_contenido
  ADD CONSTRAINT moodle_contenido_tipo_check
  CHECK (tipo IN ('texto','pdf','powerpoint','video','diapositivas','enlace'));

ALTER TABLE public.moodle_asignaciones
  ADD COLUMN IF NOT EXISTS examen_desbloqueado boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.moodle_progreso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id uuid NOT NULL REFERENCES public.moodle_asignaciones(id) ON DELETE CASCADE,
  contenido_id uuid NOT NULL REFERENCES public.moodle_contenido(id) ON DELETE CASCADE,
  empleado_id uuid NOT NULL,
  iniciado_at timestamptz NOT NULL DEFAULT now(),
  completado_at timestamptz,
  segundos_acumulados integer NOT NULL DEFAULT 0 CHECK (segundos_acumulados >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asignacion_id, contenido_id)
);

CREATE INDEX IF NOT EXISTS moodle_progreso_empleado_idx
  ON public.moodle_progreso(empleado_id, asignacion_id);

ALTER TABLE public.moodle_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moodle_progreso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_moodle_modulos" ON public.moodle_modulos;
CREATE POLICY "select_moodle_modulos" ON public.moodle_modulos
  FOR SELECT TO authenticated USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.moodle_asignaciones ma
      JOIN public.empleados e ON e.id = ma.empleado_id
      WHERE ma.curso_id = moodle_modulos.curso_id AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_moodle_modulos" ON public.moodle_modulos;
CREATE POLICY "insert_moodle_modulos" ON public.moodle_modulos
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "update_moodle_modulos" ON public.moodle_modulos;
CREATE POLICY "update_moodle_modulos" ON public.moodle_modulos
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "delete_moodle_modulos" ON public.moodle_modulos;
CREATE POLICY "delete_moodle_modulos" ON public.moodle_modulos
  FOR DELETE TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "select_moodle_progreso" ON public.moodle_progreso;
CREATE POLICY "select_moodle_progreso" ON public.moodle_progreso
  FOR SELECT TO authenticated USING (
    public.is_staff() OR empleado_id IN (
      SELECT e.id FROM public.empleados e WHERE e.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "insert_moodle_progreso_staff" ON public.moodle_progreso;
CREATE POLICY "insert_moodle_progreso_staff" ON public.moodle_progreso
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "update_moodle_progreso_staff" ON public.moodle_progreso;
CREATE POLICY "update_moodle_progreso_staff" ON public.moodle_progreso
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "delete_moodle_progreso_staff" ON public.moodle_progreso;
CREATE POLICY "delete_moodle_progreso_staff" ON public.moodle_progreso
  FOR DELETE TO authenticated USING (public.is_staff());

DO $$
DECLARE
  v_curso record;
  v_modulo uuid;
BEGIN
  FOR v_curso IN SELECT id FROM public.moodle_cursos LOOP
    SELECT id INTO v_modulo FROM public.moodle_modulos WHERE curso_id = v_curso.id ORDER BY orden, created_at LIMIT 1;
    IF v_modulo IS NULL THEN
      INSERT INTO public.moodle_modulos (curso_id, titulo, descripcion, orden)
      VALUES (v_curso.id, 'Módulo 1', 'Contenido inicial del curso', 0)
      RETURNING id INTO v_modulo;
    END IF;
    UPDATE public.moodle_contenido SET modulo_id = v_modulo WHERE curso_id = v_curso.id AND modulo_id IS NULL;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.moodle_marcar_inicio(p_contenido_id uuid)
RETURNS public.moodle_progreso
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_empleado uuid;
  v_curso uuid;
  v_asignacion uuid;
  v_result public.moodle_progreso;
BEGIN
  SELECT id INTO v_empleado FROM public.empleados WHERE user_id = auth.uid() AND activo = true LIMIT 1;
  IF v_empleado IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;

  SELECT mc.curso_id INTO v_curso FROM public.moodle_contenido mc WHERE mc.id = p_contenido_id AND mc.visible_empleado = true;
  IF v_curso IS NULL THEN RAISE EXCEPTION 'Contenido no disponible'; END IF;

  SELECT ma.id INTO v_asignacion FROM public.moodle_asignaciones ma
  WHERE ma.curso_id = v_curso AND ma.empleado_id = v_empleado;
  IF v_asignacion IS NULL THEN RAISE EXCEPTION 'Curso no asignado'; END IF;

  INSERT INTO public.moodle_progreso (asignacion_id, contenido_id, empleado_id)
  VALUES (v_asignacion, p_contenido_id, v_empleado)
  ON CONFLICT (asignacion_id, contenido_id) DO UPDATE SET updated_at = now()
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.moodle_marcar_completado(p_contenido_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_empleado uuid;
  v_progreso public.moodle_progreso;
  v_contenido public.moodle_contenido;
  v_prev_count integer;
  v_done_count integer;
  v_total_count integer;
  v_percentage integer;
BEGIN
  SELECT id INTO v_empleado FROM public.empleados WHERE user_id = auth.uid() AND activo = true LIMIT 1;
  IF v_empleado IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;

  SELECT mp.* INTO v_progreso FROM public.moodle_progreso mp
  WHERE mp.contenido_id = p_contenido_id AND mp.empleado_id = v_empleado;
  IF v_progreso.id IS NULL THEN RAISE EXCEPTION 'Contenido no iniciado'; END IF;
  IF v_progreso.completado_at IS NOT NULL THEN
    SELECT progreso INTO v_percentage FROM public.moodle_asignaciones WHERE id = v_progreso.asignacion_id;
    RETURN COALESCE(v_percentage, 0);
  END IF;

  SELECT * INTO v_contenido FROM public.moodle_contenido WHERE id = p_contenido_id;
  SELECT count(*) INTO v_prev_count
  FROM public.moodle_contenido current_content
  WHERE current_content.modulo_id = v_contenido.modulo_id
    AND current_content.es_obligatorio = true
    AND current_content.orden < v_contenido.orden
    AND NOT EXISTS (
      SELECT 1 FROM public.moodle_progreso prior_progress
      WHERE prior_progress.contenido_id = current_content.id
        AND prior_progress.asignacion_id = v_progreso.asignacion_id
        AND prior_progress.completado_at IS NOT NULL
    );
  IF v_prev_count > 0 THEN RAISE EXCEPTION 'Completa primero el contenido anterior'; END IF;

  IF extract(epoch FROM (now() - v_progreso.iniciado_at)) < (v_contenido.duracion_minutos * 60) THEN
    RAISE EXCEPTION 'Aún no se ha alcanzado el tiempo mínimo';
  END IF;

  UPDATE public.moodle_progreso SET completado_at = now(), updated_at = now()
  WHERE id = v_progreso.id;

  SELECT count(*) INTO v_done_count FROM public.moodle_contenido mc
  WHERE mc.curso_id = v_contenido.curso_id AND mc.es_obligatorio = true
    AND EXISTS (SELECT 1 FROM public.moodle_progreso mp WHERE mp.contenido_id = mc.id AND mp.asignacion_id = v_progreso.asignacion_id AND mp.completado_at IS NOT NULL);
  SELECT count(*) INTO v_total_count FROM public.moodle_contenido mc
  WHERE mc.curso_id = v_contenido.curso_id AND mc.es_obligatorio = true;
  v_percentage := CASE WHEN v_total_count = 0 THEN 100 ELSE floor((v_done_count::numeric / v_total_count::numeric) * 100)::integer END;

  UPDATE public.moodle_asignaciones SET progreso = v_percentage,
    estado = CASE WHEN v_percentage >= 100 THEN 'completado' ELSE 'en_curso' END,
    fecha_completado = CASE WHEN v_percentage >= 100 THEN COALESCE(fecha_completado, now()) ELSE fecha_completado END,
    examen_desbloqueado = v_percentage >= 100
  WHERE id = v_progreso.asignacion_id;
  RETURN v_percentage;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.moodle_marcar_inicio(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.moodle_marcar_completado(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.moodle_marcar_inicio(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moodle_marcar_completado(uuid) TO authenticated;
