-- Tabla de departamentos exclusivos para PRL (independiente de departamentos de incidencias)
CREATE TABLE IF NOT EXISTS public.departamentos_prl (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  society_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.departamentos_prl ENABLE ROW LEVEL SECURITY;

-- Tabla intermedia empleado ↔ departamento_prl (un empleado puede estar en varios)
CREATE TABLE IF NOT EXISTS public.empleados_departamentos_prl (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  departamento_prl_id uuid NOT NULL REFERENCES public.departamentos_prl(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empleado_id, departamento_prl_id)
);

ALTER TABLE public.empleados_departamentos_prl ENABLE ROW LEVEL SECURITY;

-- RLS: departamentos_prl visible para autenticados
CREATE POLICY "select_departamentos_prl" ON public.departamentos_prl
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_departamentos_prl" ON public.departamentos_prl
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_departamentos_prl" ON public.departamentos_prl
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_departamentos_prl" ON public.departamentos_prl
  FOR DELETE TO authenticated USING (true);

-- RLS: asignaciones visibles para autenticados
CREATE POLICY "select_empleados_departamentos_prl" ON public.empleados_departamentos_prl
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_empleados_departamentos_prl" ON public.empleados_departamentos_prl
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_empleados_departamentos_prl" ON public.empleados_departamentos_prl
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_empleados_departamentos_prl" ON public.empleados_departamentos_prl
  FOR DELETE TO authenticated USING (true);
