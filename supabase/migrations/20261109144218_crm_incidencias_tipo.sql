/*
# CRM incidencias: tipo de incidencia

1. Tabla modificada
- crm_incidencias: nueva columna `tipo` (texto), con valores permitidos:
  - alteracion_conducta
  - derivacion_hospitalaria
  - caidas
  - otro

2. Datos existentes
- Las incidencias ya registradas se marcan automáticamente como "otro", que es el formulario genérico anterior.

3. Seguridad
- Sin cambios en RLS ni en permisos: la tabla conserva sus políticas y grants actuales.
*/

ALTER TABLE crm_incidencias ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'otro';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_incidencias_tipo_check'
  ) THEN
    ALTER TABLE crm_incidencias
      ADD CONSTRAINT crm_incidencias_tipo_check
      CHECK (tipo IN ('alteracion_conducta', 'derivacion_hospitalaria', 'caidas', 'otro'));
  END IF;
END $$;
