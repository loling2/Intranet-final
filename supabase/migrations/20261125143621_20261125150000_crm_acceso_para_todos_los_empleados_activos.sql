/*
# CRM: acceso para todos los empleados activos con visibilidad por centro

## Resumen
Hasta ahora solo entraban al CRM admin, rrhh, perfiles 'crm', usuarios con
asignaciones manuales o con centros asignados (37 de 521 usuarios). A partir de
ahora, cualquier usuario activo tiene acceso al panel CRM. La visibilidad de
residentes sigue limitada a los centros que cada usuario tiene asignados en
`crm_usuario_centros` (más asignaciones manuales); los gestores (admin, rrhh,
supervisor, coordinador) siguen viendo todo lo que ya veían.

Además, se ajusta la escritura para que cualquier usuario pueda leer y editar
lo que le corresponde por visibilidad de centro (antes notas, documentos y la
edición de residentes exigían ser gestor CRM):

1. `can_access_crm()`: ahora devuelve true para cualquier usuario activo de
   `user_profiles`. Es la puerta de entrada al panel; no cambia ningún rol.
2. `crm_notas`: SELECT/INSERT/UPDATE pasan de exigir `crm_es_gestor()` a
   exigir únicamente `crm_puede_ver_residente(usuario_servicio_id)`
   (visible por centro asignado o asignación manual).
3. `crm_documentos`: SELECT/INSERT/UPDATE/DELETE pasan de ser exclusivos de
   admin/rrhh a `crm_puede_ver_residente(usuario_servicio_id)`.
4. `usuarios_servicios`:
   - SELECT (política de centros): pasa de exigir gestor a
     `crm_puede_ver_residente(id)`, coherente con la visibilidad por centro.
   - UPDATE (política de gestores): pasa de `crm_es_gestor() AND
     crm_puede_ver_residente(id)` a `crm_puede_ver_residente(id)`, para que
     un empleado pueda editar los datos del residente de su centro.
   - INSERT y DELETE de residentes siguen limitados a gestores y admin/rrhh
     (crear y borrar residentes son acciones de gestión).
5. `get_crm_tratamiento_nivel()`: si el usuario ve el residente pero no tiene
   un permiso por puesto en `crm_tratamiento_permisos`, ahora obtiene nivel
   'editar' por defecto (antes NULL, sin acceso). Coherente con "pueden
   escribir en todos los campos que tengan visible".

## Seguridad
- No se crean tablas ni se modifican columnas; no se pierden datos.
- Las políticas se recrean con DROP POLICY IF EXISTS + CREATE POLICY
  (idempotente) y se mantiene `TO authenticated`.
- La visibilidad por centro NO cambia: solo se elimina la exigencia adicional
  de ser gestor para leer/editar lo ya visible.
- `can_access_crm()` sigue siendo SECURITY DEFINER con search_path fijo.
- Funciones recreadas con CREATE OR REPLACE: mismos parámetros y retorno.
*/

-- 1. Puerta de entrada: cualquier usuario activo tiene acceso al CRM
CREATE OR REPLACE FUNCTION public.can_access_crm()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.user_profiles
  WHERE id = auth.uid()
  AND COALESCE(activo, true)
);
$$;

-- 2. Notas del residente: lectura y escritura por visibilidad
DROP POLICY IF EXISTS "crm_notas_select_staff" ON crm_notas;
CREATE POLICY "crm_notas_select_staff" ON crm_notas FOR SELECT
  TO authenticated
  USING (crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_notas_insert_staff" ON crm_notas;
CREATE POLICY "crm_notas_insert_staff" ON crm_notas FOR INSERT
  TO authenticated
  WITH CHECK (crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_notas_update_staff" ON crm_notas;
CREATE POLICY "crm_notas_update_staff" ON crm_notas FOR UPDATE
  TO authenticated
  USING (crm_puede_ver_residente(usuario_servicio_id))
  WITH CHECK (crm_puede_ver_residente(usuario_servicio_id));

-- 3. Documentos del residente: lectura y escritura por visibilidad
DROP POLICY IF EXISTS "crm_doc_select_staff" ON crm_documentos;
CREATE POLICY "crm_doc_select_staff" ON crm_documentos FOR SELECT
  TO authenticated
  USING (crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_doc_insert_staff" ON crm_documentos;
CREATE POLICY "crm_doc_insert_staff" ON crm_documentos FOR INSERT
  TO authenticated
  WITH CHECK (crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_doc_update_staff" ON crm_documentos;
CREATE POLICY "crm_doc_update_staff" ON crm_documentos FOR UPDATE
  TO authenticated
  USING (crm_puede_ver_residente(usuario_servicio_id))
  WITH CHECK (crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_doc_delete_staff" ON crm_documentos;
CREATE POLICY "crm_doc_delete_staff" ON crm_documentos FOR DELETE
  TO authenticated
  USING (crm_puede_ver_residente(usuario_servicio_id));

-- 4. Residentes: SELECT y UPDATE coherentes con la visibilidad por centro
DROP POLICY IF EXISTS "usuarios_servicios_select_crm_gestores" ON usuarios_servicios;
CREATE POLICY "usuarios_servicios_select_crm_gestores"
  ON usuarios_servicios FOR SELECT TO authenticated
  USING (crm_puede_ver_residente(id));

DROP POLICY IF EXISTS "usuarios_servicios_update_crm_gestores" ON usuarios_servicios;
CREATE POLICY "usuarios_servicios_update_crm_gestores"
  ON usuarios_servicios FOR UPDATE TO authenticated
  USING (crm_puede_ver_residente(id))
  WITH CHECK (crm_puede_ver_residente(id));

-- 5. Tratamientos: nivel por defecto 'editar' para quien ve el residente
CREATE OR REPLACE FUNCTION public.get_crm_tratamiento_nivel(p_usuario_servicio_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT CASE
WHEN crm_es_admin_o_rrhh() THEN 'total'
WHEN crm_es_gestor() AND crm_puede_ver_residente(p_usuario_servicio_id) THEN 'editar'
WHEN NOT crm_puede_ver_residente(p_usuario_servicio_id) THEN NULL
ELSE COALESCE((
  SELECT p.nivel
  FROM crm_tratamiento_permisos p
  JOIN empleados e ON e.puesto_tag_id = p.puesto_tag_id
  WHERE p.usuario_servicio_id = p_usuario_servicio_id
  AND e.user_id = auth.uid()
  ORDER BY (p.nivel = 'editar') DESC
  LIMIT 1
), 'editar')
END;
$$;
