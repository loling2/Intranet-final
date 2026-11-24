/*
# Allow scoped CRM gestores to save resident information

## Problem
CRM supervisors and coordinators could open residents assigned through their
centers, but several resident sections only recognized direct
`crm_paciente_asignaciones` rows. Saving contacts, accounts, medical data,
treatment data, incidents, or calendar notes therefore failed for residents
visible through a center. The treatment access function had the same limitation.

## Changes

### 1. Resident child records
Update the SELECT, INSERT, UPDATE, and DELETE policies for the resident-owned
CRM records that are edited from the resident file:
- `crm_residente_contactos`
- `crm_residente_cuentas`
- `crm_residente_medico`
- `crm_residente_tratamiento`

A CRM gestor can manage these records when `crm_puede_ver_residente` confirms
that the resident is assigned directly or belongs to one of the gestor's
assigned centers. Admin and RRHH remain covered by the same helper.

### 2. CRM incidents and calendar notes
Allow scoped CRM gestores to read, create, and update:
- `crm_incidencias`
- `crm_notas`

Deletion remains restricted to the existing administrative policy.

### 3. Treatment access
Update `get_crm_tratamiento_nivel` so a supervisor or coordinator with scoped
access receives the `editar` level. Admin and RRHH retain `total`; other users
keep the existing profession-based treatment permissions.

## Security
- Every write remains restricted to authenticated users.
- Access is evaluated server-side with `auth.uid()` through
  `crm_puede_ver_residente`; no resident or user identifier supplied by the
  browser can grant access.
- Center-based access is limited to the centers assigned to the current user.
- No table grants are broadened and no data is deleted.
*/

DROP POLICY IF EXISTS "crm_contactos_select" ON crm_residente_contactos;
CREATE POLICY "crm_contactos_select"
ON crm_residente_contactos FOR SELECT
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_contactos_insert" ON crm_residente_contactos;
CREATE POLICY "crm_contactos_insert"
ON crm_residente_contactos FOR INSERT
TO authenticated
WITH CHECK (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_contactos_update" ON crm_residente_contactos;
CREATE POLICY "crm_contactos_update"
ON crm_residente_contactos FOR UPDATE
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id))
WITH CHECK (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_contactos_delete" ON crm_residente_contactos;
CREATE POLICY "crm_contactos_delete"
ON crm_residente_contactos FOR DELETE
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_cuentas_select" ON crm_residente_cuentas;
CREATE POLICY "crm_cuentas_select"
ON crm_residente_cuentas FOR SELECT
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_cuentas_insert" ON crm_residente_cuentas;
CREATE POLICY "crm_cuentas_insert"
ON crm_residente_cuentas FOR INSERT
TO authenticated
WITH CHECK (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_cuentas_update" ON crm_residente_cuentas;
CREATE POLICY "crm_cuentas_update"
ON crm_residente_cuentas FOR UPDATE
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id))
WITH CHECK (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_cuentas_delete" ON crm_residente_cuentas;
CREATE POLICY "crm_cuentas_delete"
ON crm_residente_cuentas FOR DELETE
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_medico_select" ON crm_residente_medico;
CREATE POLICY "crm_medico_select"
ON crm_residente_medico FOR SELECT
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_medico_insert" ON crm_residente_medico;
CREATE POLICY "crm_medico_insert"
ON crm_residente_medico FOR INSERT
TO authenticated
WITH CHECK (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_medico_update" ON crm_residente_medico;
CREATE POLICY "crm_medico_update"
ON crm_residente_medico FOR UPDATE
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id))
WITH CHECK (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_medico_delete" ON crm_residente_medico;
CREATE POLICY "crm_medico_delete"
ON crm_residente_medico FOR DELETE
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_tratamiento_select" ON crm_residente_tratamiento;
CREATE POLICY "crm_tratamiento_select"
ON crm_residente_tratamiento FOR SELECT
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_tratamiento_insert" ON crm_residente_tratamiento;
CREATE POLICY "crm_tratamiento_insert"
ON crm_residente_tratamiento FOR INSERT
TO authenticated
WITH CHECK (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_tratamiento_update" ON crm_residente_tratamiento;
CREATE POLICY "crm_tratamiento_update"
ON crm_residente_tratamiento FOR UPDATE
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id))
WITH CHECK (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_tratamiento_delete" ON crm_residente_tratamiento;
CREATE POLICY "crm_tratamiento_delete"
ON crm_residente_tratamiento FOR DELETE
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_inc_select_staff" ON crm_incidencias;
CREATE POLICY "crm_inc_select_staff"
ON crm_incidencias FOR SELECT
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_inc_insert_staff" ON crm_incidencias;
CREATE POLICY "crm_inc_insert_staff"
ON crm_incidencias FOR INSERT
TO authenticated
WITH CHECK (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_inc_update_staff" ON crm_incidencias;
CREATE POLICY "crm_inc_update_staff"
ON crm_incidencias FOR UPDATE
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id))
WITH CHECK (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_notas_select_staff" ON crm_notas;
CREATE POLICY "crm_notas_select_staff"
ON crm_notas FOR SELECT
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_notas_insert_staff" ON crm_notas;
CREATE POLICY "crm_notas_insert_staff"
ON crm_notas FOR INSERT
TO authenticated
WITH CHECK (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

CREATE OR REPLACE FUNCTION get_crm_tratamiento_nivel(p_usuario_servicio_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT CASE
  WHEN crm_es_admin_o_rrhh() THEN 'total'
  WHEN crm_es_gestor() AND crm_puede_ver_residente(p_usuario_servicio_id) THEN 'editar'
  WHEN NOT crm_puede_ver_residente(p_usuario_servicio_id) THEN NULL
  ELSE (
    SELECT p.nivel
    FROM crm_tratamiento_permisos p
    JOIN empleados e ON e.puesto_tag_id = p.puesto_tag_id
    WHERE p.usuario_servicio_id = p_usuario_servicio_id
      AND e.user_id = auth.uid()
    ORDER BY (p.nivel = 'editar') DESC
    LIMIT 1
  )
END;
$$;

REVOKE EXECUTE ON FUNCTION get_crm_tratamiento_nivel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_crm_tratamiento_nivel(uuid) TO authenticated;
