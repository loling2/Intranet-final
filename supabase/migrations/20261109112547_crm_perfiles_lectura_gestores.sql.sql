/*
# CRM perfiles: lectura también para gestores

## Resumen
El supervisor debe poder ver los puestos y sus pestañas activas en la pestaña Permisos,
aunque no tenga el acceso general al CRM.

## Cambios
- crm_perfiles: la lectura se amplía a crm_es_gestor() (admin, rrhh, supervisor).
- crm_perfil_pestanas: la lectura se amplía a crm_es_gestor().

## Seguridad
- Sólo se añade lectura; las escrituras ya dependen de crm_es_gestor().
- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE POLICY.
*/

DROP POLICY IF EXISTS "crm_perfiles_select" ON crm_perfiles;
CREATE POLICY "crm_perfiles_select" ON crm_perfiles FOR SELECT
  TO authenticated
  USING (can_access_crm() OR crm_es_gestor());

DROP POLICY IF EXISTS "crm_perfil_pestanas_select" ON crm_perfil_pestanas;
CREATE POLICY "crm_perfil_pestanas_select" ON crm_perfil_pestanas FOR SELECT
  TO authenticated
  USING (can_access_crm() OR crm_es_gestor());
