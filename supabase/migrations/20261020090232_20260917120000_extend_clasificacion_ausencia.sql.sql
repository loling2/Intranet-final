/*
# Extend clasificacion_ausencia with new absence types

1. Changes
- The CHECK constraint `fichajes_correcciones_clasificacion_ausencia_check`
  currently allows: NULL, 'no_fichado', 'dia_libre', 'asuntos_propios'.
- This migration drops and recreates the constraint to also allow
  'dia_compensado' and 'festivo', so employees can classify a "no fichado"
  day as Día Compensado or Festivo when requesting a correction.

2. Security
- No RLS or policy changes. No new tables or columns. Existing rows are
  untouched — the change only widens the set of allowed values.

3. Notes
- DROP CONSTRAINT + ADD CONSTRAINT is required because ALTER CONSTRAINT
  syntax is not supported for CHECK constraints in Postgres.
- The operation is safe to re-run (idempotent): the DROP uses IF EXISTS.
*/

ALTER TABLE fichajes_correcciones
  DROP CONSTRAINT IF EXISTS fichajes_correcciones_clasificacion_ausencia_check;

ALTER TABLE fichajes_correcciones
  ADD CONSTRAINT fichajes_correcciones_clasificacion_ausencia_check
  CHECK (clasificacion_ausencia IS NULL OR clasificacion_ausencia IN (
    'no_fichado', 'dia_libre', 'dia_compensado', 'festivo', 'asuntos_propios'
  ));
