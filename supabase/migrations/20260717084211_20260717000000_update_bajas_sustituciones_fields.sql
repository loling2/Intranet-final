/*
# Ampliación tablas Bajas y Sustituciones

## Cambios en bajas_temporales
- `larga_duracion` (boolean, default false): Cuando es true, la baja no tiene fecha de fin definida
- `dias_no_cubiertos` (integer, default 0): Días de la baja que no necesitan cobertura (días libres del trabajador)

## Cambios en sustituciones
- `tipo_cobertura` (text): Cómo se retribuye al sustituto — 'pagar', 'compensar', 'otro'
- `turno` (text): Turno del sustituto — 'mañana', 'tarde', 'noche'
- `es_festivo` (boolean, default false): Si el día/período es festivo
- `unidad` (text, default 'dias'): Unidad de cobertura — 'dias' u 'horas'
- `num_horas` (numeric, default 0): Horas cubiertas (cuando unidad='horas' o para cálculo de nocturnas)

## Notas
- Todos los cambios son aditivos (ADD COLUMN IF NOT EXISTS), no destructivos
- Compatible con registros existentes (valores NULL/default en columnas nuevas)
*/

ALTER TABLE bajas_temporales
  ADD COLUMN IF NOT EXISTS larga_duracion boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dias_no_cubiertos integer DEFAULT 0;

ALTER TABLE sustituciones
  ADD COLUMN IF NOT EXISTS tipo_cobertura text,
  ADD COLUMN IF NOT EXISTS turno text,
  ADD COLUMN IF NOT EXISTS es_festivo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS unidad text DEFAULT 'dias',
  ADD COLUMN IF NOT EXISTS num_horas numeric(6,2) DEFAULT 0;
