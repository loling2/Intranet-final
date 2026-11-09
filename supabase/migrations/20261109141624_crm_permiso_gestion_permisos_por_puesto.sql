/*
# CRM: el permiso "Permisos" puede concederse por puesto

## Resumen
Además de admin, rrhh y supervisor, un puesto puede tener activa la pestaña
"Permisos" del CRM. Quien tenga ese permiso puede configurar pestañas por puesto
y asignar centros a trabajadores, igual que un gestor.

## 1. Nueva función: crm_puede_gestionar_permisos()
- Verdadero si el usuario es gestor (crm_es_gestor) o si su puesto tiene activa la
  pestaña "permisos" en su perfil CRM.

## 2. Políticas ampliadas
- crm_usuario_centros: lectura, alta, modificación y baja usan la nueva función.
- crm_perfil_pestanas: alta, modificación y baja usan la nueva función.

## Seguridad
- Función SECURITY DEFINER con search_path fijado; EXECUTE revocado de PUBLIC y anon.
- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE POLICY.
*/

CREATE OR REPLACE FUNCTION public.crm_puede_gestionar_permisos()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT public.crm_es_gestor() OR EXISTS (
  SELECT 1
  FROM public.empleados e
  JOIN public.crm_perfiles cp ON cp.puesto_tag_id = e.puesto_tag_id
  JOIN public.crm_perfil_pestanas pp ON pp.perfil_id = cp.id
  WHERE e.user_id = auth.uid()
    AND e.activo = true
    AND pp.pestana = 'permisos'
    AND pp.activo = true
);
$$;

REVOKE EXECUTE ON FUNCTION public.crm_puede_gestionar_permisos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_puede_gestionar_permisos() TO authenticated;

DROP POLICY IF EXISTS "select_crm_usuario_centros" ON crm_usuario_centros;
CREATE POLICY "select_crm_usuario_centros" ON crm_usuario_centros FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR crm_puede_gestionar_permisos());

DROP POLICY IF EXISTS "insert_crm_usuario_centros" ON crm_usuario_centros;
CREATE POLICY "insert_crm_usuario_centros" ON crm_usuario_centros FOR INSERT
  TO authenticated
  WITH CHECK (crm_puede_gestionar_permisos());

DROP POLICY IF EXISTS "update_crm_usuario_centros" ON crm_usuario_centros;
CREATE POLICY "update_crm_usuario_centros" ON crm_usuario_centros FOR UPDATE
  TO authenticated
  USING (crm_puede_gestionar_permisos())
  WITH CHECK (crm_puede_gestionar_permisos());

DROP POLICY IF EXISTS "delete_crm_usuario_centros" ON crm_usuario_centros;
CREATE POLICY "delete_crm_usuario_centros" ON crm_usuario_centros FOR DELETE
  TO authenticated
  USING (crm_puede_gestionar_permisos());

DROP POLICY IF EXISTS "insert_crm_perfil_pestanas" ON crm_perfil_pestanas;
CREATE POLICY "insert_crm_perfil_pestanas" ON crm_perfil_pestanas FOR INSERT
  TO authenticated
  WITH CHECK (crm_puede_gestionar_permisos());

DROP POLICY IF EXISTS "update_crm_perfil_pestanas" ON crm_perfil_pestanas;
CREATE POLICY "update_crm_perfil_pestanas" ON crm_perfil_pestanas FOR UPDATE
  TO authenticated
  USING (crm_puede_gestionar_permisos())
  WITH CHECK (crm_puede_gestionar_permisos());

DROP POLICY IF EXISTS "delete_crm_perfil_pestanas" ON crm_perfil_pestanas;
CREATE POLICY "delete_crm_perfil_pestanas" ON crm_perfil_pestanas FOR DELETE
  TO authenticated
  USING (crm_puede_gestionar_permisos());
