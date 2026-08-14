-- When a centro is renamed in public.centros, automatically update all employees
-- whose centro_trabajo matches the old name, so reports always show the current name.
-- Without this, empleados.centro_trabajo becomes a stale snapshot after a rename.

CREATE OR REPLACE FUNCTION public.sync_centro_rename_to_empleados()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
    UPDATE public.empleados
      SET centro_trabajo = NEW.nombre,
          updated_at = now()
      WHERE centro_trabajo = OLD.nombre;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_centro_rename_sync ON public.centros;
CREATE TRIGGER trg_centro_rename_sync
  AFTER UPDATE OF nombre ON public.centros
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_centro_rename_to_empleados();

REVOKE ALL ON FUNCTION public.sync_centro_rename_to_empleados() FROM PUBLIC;
