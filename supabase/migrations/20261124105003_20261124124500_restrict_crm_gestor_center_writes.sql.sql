/*
# Restringir escrituras CRM de gestores a sus centros

1. Propósito
- La pantalla solo muestra los centros asignados, pero una llamada directa a la API
  podía intentar modificar residentes o asignaciones de otros centros.
- Se mantienen los permisos completos de admin y RRHH y se limita a supervisor y
  coordinador al alcance real de sus centros.

2. Tablas modificadas
- `usuarios_servicios`: los gestores no administrativos solo pueden editar residentes
  que pueden ver; las altas se realizan mediante `create_crm_residente`.
- `usuarios_servicios_centros`: gestores no administrativos solo pueden leer, añadir
  o quitar asignaciones de sus centros y de residentes dentro de su alcance.

3. Seguridad
- Se reemplazan únicamente políticas RLS existentes.
- No se borran columnas ni registros.
- La función segura de alta sigue validando cada centro y crea residente y asignaciones
  en una sola operación.

4. Compatibilidad
- Admin y RRHH conservan el acceso global.
- Supervisores y coordinadores siguen pudiendo editar residentes de sus centros.
*/

DROP POLICY IF EXISTS "usuarios_servicios_insert_crm_gestores" ON public.usuarios_servicios;
CREATE POLICY "usuarios_servicios_insert_crm_gestores"
  ON public.usuarios_servicios FOR INSERT TO authenticated
  WITH CHECK (public.crm_es_admin_o_rrhh());

DROP POLICY IF EXISTS "usuarios_servicios_update_crm_gestores" ON public.usuarios_servicios;
CREATE POLICY "usuarios_servicios_update_crm_gestores"
  ON public.usuarios_servicios FOR UPDATE TO authenticated
  USING (
    public.crm_es_admin_o_rrhh()
    OR (public.crm_es_gestor() AND public.crm_puede_ver_residente(id))
  )
  WITH CHECK (
    public.crm_es_admin_o_rrhh()
    OR (public.crm_es_gestor() AND public.crm_puede_ver_residente(id))
  );

DROP POLICY IF EXISTS "us_centros_select_crm_gestores" ON public.usuarios_servicios_centros;
CREATE POLICY "us_centros_select_crm_gestores"
  ON public.usuarios_servicios_centros FOR SELECT TO authenticated
  USING (
    public.crm_es_admin_o_rrhh()
    OR (
      public.crm_es_gestor()
      AND EXISTS (
        SELECT 1
        FROM public.crm_usuario_centros ucc
        WHERE ucc.user_id = auth.uid()
          AND ucc.centro_id = usuarios_servicios_centros.centro_id
      )
    )
  );

DROP POLICY IF EXISTS "us_centros_insert_crm_gestores" ON public.usuarios_servicios_centros;
CREATE POLICY "us_centros_insert_crm_gestores"
  ON public.usuarios_servicios_centros FOR INSERT TO authenticated
  WITH CHECK (
    public.crm_es_admin_o_rrhh()
    OR (
      public.crm_es_gestor()
      AND public.crm_puede_ver_residente(usuario_servicio_id)
      AND EXISTS (
        SELECT 1
        FROM public.crm_usuario_centros ucc
        WHERE ucc.user_id = auth.uid()
          AND ucc.centro_id = usuarios_servicios_centros.centro_id
      )
    )
  );

DROP POLICY IF EXISTS "us_centros_delete_crm_gestores" ON public.usuarios_servicios_centros;
CREATE POLICY "us_centros_delete_crm_gestores"
  ON public.usuarios_servicios_centros FOR DELETE TO authenticated
  USING (
    public.crm_es_admin_o_rrhh()
    OR (
      public.crm_es_gestor()
      AND public.crm_puede_ver_residente(usuario_servicio_id)
      AND EXISTS (
        SELECT 1
        FROM public.crm_usuario_centros ucc
        WHERE ucc.user_id = auth.uid()
          AND ucc.centro_id = usuarios_servicios_centros.centro_id
      )
    )
  );
