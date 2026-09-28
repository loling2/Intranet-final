-- Drop partial unique index and recreate as full unique constraint
DROP INDEX IF EXISTS public.examen_asignaciones_examen_empleado_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS examen_asignaciones_examen_empleado_uniq
  ON public.examen_asignaciones (examen_id, empleado_id);