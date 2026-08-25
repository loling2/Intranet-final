/*
# Add horas_diarias column to empleados

1. New Column
- `empleados.horas_diarias` (numeric, nullable): número de horas diarias esperadas
  del empleado. Admite decimales (ej. 7.5). Por defecto 8.
2. Notes
- Se usa en fichajes para determinar si una jornada es correcta, déficit o exceso,
  con una tolerancia de ±10 minutos.
- No se eliminan datos existentes; la columna es nullable y se backfill con 8.
*/

ALTER TABLE empleados
  ADD COLUMN IF NOT EXISTS horas_diarias numeric(4,2);

UPDATE empleados SET horas_diarias = 8 WHERE horas_diarias IS NULL;
