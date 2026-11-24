-- Sincroniza los centros de los gestores CRM (supervisor/coordinador/admin/rrhh/crm)
-- desde la tabla empleados (centro_id) hacia crm_usuario_centros,
-- y añade un trigger para mantener la sincronización automática.

INSERT INTO crm_usuario_centros (user_id, centro_id)
SELECT DISTINCT e.user_id, e.centro_id
FROM empleados e
JOIN user_profiles up ON up.id = e.user_id
WHERE e.centro_id IS NOT NULL
  AND (
    up.role IN ('supervisor', 'coordinador', 'admin', 'rrhh', 'crm')
    OR up.roles && ARRAY['supervisor', 'coordinador', 'crm']::text[]
  )
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_crm_usuario_centros_from_empleado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_roles text[];
BEGIN
  SELECT role, roles INTO v_role, v_roles
  FROM user_profiles
  WHERE id = NEW.user_id;

  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_role IN ('supervisor', 'coordinador', 'admin', 'rrhh', 'crm')
     OR v_roles && ARRAY['supervisor', 'coordinador', 'crm']::text[] THEN
    INSERT INTO crm_usuario_centros (user_id, centro_id)
    VALUES (NEW.user_id, NEW.centro_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_crm_usuario_centros ON empleados;
CREATE TRIGGER trg_sync_crm_usuario_centros
AFTER INSERT OR UPDATE OF centro_id, user_id ON empleados
FOR EACH ROW EXECUTE FUNCTION sync_crm_usuario_centros_from_empleado();