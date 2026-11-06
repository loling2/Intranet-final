/*
# CRM: quién registró cada toma de medicación

## Cambios
1. Tabla `crm_tratamiento_tomas`: nuevas columnas.
   - `registrado_por` (uuid): usuario que marcó la toma como Sí o No. Se rellena automáticamente con el usuario que hace la acción.
   - `registrado_por_nombre` (text): nombre del empleado en el momento del registro, para mostrarlo sin consultas adicionales.

## Seguridad
- Sin cambios en RLS ni en permisos: las políticas existentes siguen aplicando.

## Notas
- Migración idempotente (ADD COLUMN IF NOT EXISTS).
- Los registros anteriores quedan con nombre vacío y sin autor.
*/

ALTER TABLE crm_tratamiento_tomas ADD COLUMN IF NOT EXISTS registrado_por uuid DEFAULT auth.uid();
ALTER TABLE crm_tratamiento_tomas ADD COLUMN IF NOT EXISTS registrado_por_nombre text NOT NULL DEFAULT '';
