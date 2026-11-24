/*
# Complete scoped CRM note and document writes

## Problem
Calendar notes had INSERT access for scoped CRM gestores but no UPDATE policy,
so editing an existing note failed. Document records also had inconsistent
policies: uploads were allowed broadly while deletion was limited to admin and
RRHH, which made the resident file appear editable but fail on some actions.

## Changes

### 1. Calendar notes
Add an UPDATE policy to `crm_notas` for authenticated CRM gestores who can see
the resident through a direct assignment or an assigned center.

### 2. Resident documents
Scope SELECT, INSERT, UPDATE, and DELETE on:
- `crm_prestaciones_documentos`
- `crm_tratamiento_documentos`

to CRM gestores with access to the resident. This keeps supervisors and
coordinators able to save and manage documents in their scope without granting
access to other centers.

## Security
- All policies use the current authenticated user's server-side scope through
  `crm_puede_ver_residente`.
- No table grants are broadened and no data is deleted.
*/

DROP POLICY IF EXISTS "crm_notas_update_staff" ON crm_notas;
CREATE POLICY "crm_notas_update_staff"
ON crm_notas FOR UPDATE
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id))
WITH CHECK (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_prestaciones_documentos_select" ON crm_prestaciones_documentos;
CREATE POLICY "crm_prestaciones_documentos_select"
ON crm_prestaciones_documentos FOR SELECT
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_prestaciones_documentos_insert" ON crm_prestaciones_documentos;
CREATE POLICY "crm_prestaciones_documentos_insert"
ON crm_prestaciones_documentos FOR INSERT
TO authenticated
WITH CHECK (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_prestaciones_documentos_update" ON crm_prestaciones_documentos;
CREATE POLICY "crm_prestaciones_documentos_update"
ON crm_prestaciones_documentos FOR UPDATE
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id))
WITH CHECK (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_prestaciones_documentos_delete" ON crm_prestaciones_documentos;
CREATE POLICY "crm_prestaciones_documentos_delete"
ON crm_prestaciones_documentos FOR DELETE
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_tratamiento_documentos_select" ON crm_tratamiento_documentos;
CREATE POLICY "crm_tratamiento_documentos_select"
ON crm_tratamiento_documentos FOR SELECT
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_tratamiento_documentos_insert" ON crm_tratamiento_documentos;
CREATE POLICY "crm_tratamiento_documentos_insert"
ON crm_tratamiento_documentos FOR INSERT
TO authenticated
WITH CHECK (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_tratamiento_documentos_update" ON crm_tratamiento_documentos;
CREATE POLICY "crm_tratamiento_documentos_update"
ON crm_tratamiento_documentos FOR UPDATE
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id))
WITH CHECK (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));

DROP POLICY IF EXISTS "crm_tratamiento_documentos_delete" ON crm_tratamiento_documentos;
CREATE POLICY "crm_tratamiento_documentos_delete"
ON crm_tratamiento_documentos FOR DELETE
TO authenticated
USING (crm_es_gestor() AND crm_puede_ver_residente(usuario_servicio_id));
