-- Junction table: prl_folders ↔ departamentos_prl (max 5 per folder)
CREATE TABLE IF NOT EXISTS public.prl_folder_departamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.prl_folders(id) ON DELETE CASCADE,
  departamento_prl_id uuid NOT NULL REFERENCES public.departamentos_prl(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (folder_id, departamento_prl_id)
);

ALTER TABLE public.prl_folder_departamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_prl_folder_departamentos" ON public.prl_folder_departamentos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_prl_folder_departamentos" ON public.prl_folder_departamentos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_prl_folder_departamentos" ON public.prl_folder_departamentos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_prl_folder_departamentos" ON public.prl_folder_departamentos
  FOR DELETE TO authenticated USING (true);
