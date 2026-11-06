/*
# CRM: frecuencia en horas por medicación

## Cambios
1. `crm_tratamiento_medicaciones` añade la columna `frecuencia_horas` (entero, opcional).
   - Indica cada cuántas horas se administra la medicación (por ejemplo 8, 4 o 24 para "1 vez al día").
   - Vacío = sin frecuencia definida.

## Seguridad
- Sin cambios en RLS, políticas ni permisos: la columna hereda las políticas existentes.

## Notas
- Migración idempotente (ADD COLUMN IF NOT EXISTS). No altera los datos existentes.
*/

ALTER TABLE crm_tratamiento_medicaciones ADD COLUMN IF NOT EXISTS frecuencia_horas integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_tratamiento_medicaciones_frecuencia_horas_check'
  ) THEN
    ALTER TABLE crm_tratamiento_medicaciones
      ADD CONSTRAINT crm_tratamiento_medicaciones_frecuencia_horas_check
      CHECK (frecuencia_horas IS NULL OR (frecuencia_horas >= 1 AND frecuencia_horas <= 168));
  END IF;
END $$;
