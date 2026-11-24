/*
# CRM: permitir a supervisor y coordinador crear/editar residentes

## Resumen
Los perfiles `supervisor` y `coordinador` (gestores CRM) no podían crear
residentes en el panel CRM: las políticas INSERT/UPDATE/DELETE de
`usuarios_servicios` y `usuarios_servicios_centros` solo admitían
`admin`/`rrhh`, y la consulta de centros solo devolvía filas a
`admin`/`rrhh`/`prevencion`. Al intentar crear un residente, el formulario
de centros aparecía vacío y el insert fallaba silenciosamente.

Esta migración amplía las políticas para que todo gestor CRM
(`admin`, `rrhh`, `supervisor`, `coordinador`, según `crm_es_gestor()`
o rol equivalente) pueda gestionar residentes y sus asignaciones de centro,
y añade una política SELECT de centros accesible a los gestores CRM.

## 1. usuarios_servicios
- SELECT: ya permite ver vía `crm_paciente_asignaciones` o admin/rrhh.
  Se añade política que permite ver residentes de los centros asignados
  al gestor (visibilidad coherente con `crm_puede_ver_residente`).
- INSERT/UPDATE: ampliados a gestores CRM (incluye supervisor y coordinador).
- DELETE: sigue limitado a admin/rrhh (borrado sensible).

## 2. usuarios_servicios_centros
- SELECT: ampliado a gestores CRM (necesario para listar residentes + centros).
- INSERT/DELETE: ampliados a gestores CRM.

## 3. centros
- Nueva política SELECT para gestores CRM: ven los centros que tienen
  asignados en `crm_usuario_centros`. Permite poblar el desplegable de
  centros al crear/editar residentes.

## Seguridad
- RLS ya activo en todas las tablas; no se desactiva.
- No se otorgan grants nuevos: `authenticated` ya tiene CRUD en las tablas.
- Las políticas son aditivas (DROP IF EXISTS + CREATE) e idempotentes.
- No se modifican columnas ni se pierden datos.
*/

-- 1. usuarios_servicios: SELECT para gestores CRM (residentes de sus centros)
DROP POLICY IF EXISTS "usuarios_servicios_select_crm_gestores" ON usuarios_servicios;
CREATE POLICY "usuarios_servicios_select_crm_gestores"
  ON usuarios_servicios FOR SELECT TO authenticated
  USING (
    crm_es_gestor()
    AND EXISTS (
      SELECT 1
      FROM usuarios_servicios_centros uc
      JOIN crm_usuario_centros ucc ON ucc.centro_id = uc.centro_id
      WHERE uc.usuario_servicio_id = usuarios_servicios.id
        AND ucc.user_id = auth.uid()
    )
  );

-- 1b. usuarios_servicios: INSERT/UPDATE para gestores CRM
DROP POLICY IF EXISTS "usuarios_servicios_insert_crm_gestores" ON usuarios_servicios;
CREATE POLICY "usuarios_servicios_insert_crm_gestores"
  ON usuarios_servicios FOR INSERT TO authenticated
  WITH CHECK (crm_es_gestor());

DROP POLICY IF EXISTS "usuarios_servicios_update_crm_gestores" ON usuarios_servicios;
CREATE POLICY "usuarios_servicios_update_crm_gestores"
  ON usuarios_servicios FOR UPDATE TO authenticated
  USING (crm_es_gestor())
  WITH CHECK (crm_es_gestor());

-- 2. usuarios_servicios_centros: SELECT para gestores CRM
DROP POLICY IF EXISTS "us_centros_select_crm_gestores" ON usuarios_servicios_centros;
CREATE POLICY "us_centros_select_crm_gestores"
  ON usuarios_servicios_centros FOR SELECT TO authenticated
  USING (crm_es_gestor());

-- 2b. usuarios_servicios_centros: INSERT/DELETE para gestores CRM
DROP POLICY IF EXISTS "us_centros_insert_crm_gestores" ON usuarios_servicios_centros;
CREATE POLICY "us_centros_insert_crm_gestores"
  ON usuarios_servicios_centros FOR INSERT TO authenticated
  WITH CHECK (crm_es_gestor());

DROP POLICY IF EXISTS "us_centros_delete_crm_gestores" ON usuarios_servicios_centros;
CREATE POLICY "us_centros_delete_crm_gestores"
  ON usuarios_servicios_centros FOR DELETE TO authenticated
  USING (crm_es_gestor());

-- 3. centros: SELECT para gestores CRM (sus centros asignados)
DROP POLICY IF EXISTS "centros_select_crm_gestores" ON centros;
CREATE POLICY "centros_select_crm_gestores"
  ON centros FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_usuario_centros
      WHERE crm_usuario_centros.centro_id = centros.id
        AND crm_usuario_centros.user_id = auth.uid()
    )
  );
