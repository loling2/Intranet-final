-- Add unique constraint on (examen_id, empleado_id) so upserts work
CREATE UNIQUE INDEX IF NOT EXISTS examen_asignaciones_examen_empleado_uniq
  ON public.examen_asignaciones (examen_id, empleado_id);