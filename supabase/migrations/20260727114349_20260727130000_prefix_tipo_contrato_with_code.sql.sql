/*
# Prefix tipo_contrato descriptions with their numeric code

## Purpose
Following the previous migration that converted contract codes/legacy labels
to full descriptions, this migration prepends the numeric code so values read
as `100 - Indefinido ordinario (Tiempo Completo)`.

## Mapping (current value -> new value)
- `Indefinido ordinario (Tiempo Completo)` -> `100 - Indefinido ordinario (Tiempo Completo)`
- `Indefinido fijo-discontinuo (Tiempo Completo)` -> `189 - Indefinido fijo-discontinuo (Tiempo Completo)`
- `Indefinido ordinario (Tiempo Parcial)` -> `200 - Indefinido ordinario (Tiempo Parcial)`
- `Indefinido fijo-discontinuo (Tiempo Parcial)` -> `289 - Indefinido fijo-discontinuo (Tiempo Parcial)`
- `Indefinido de formacion / practicas (Tiempo Completo)` -> `130 - Indefinido de formacion / practicas (Tiempo Completo)`
- `Indefinido de formacion / practicas (Tiempo Parcial)` -> `230 - Indefinido de formacion / practicas (Tiempo Parcial)`
- `Temporal eventual por circunstancias de la produccion (Completa)` -> `410 - Temporal eventual por circunstancias de la produccion (Completa)`
- `Temporal eventual por circunstancias de la produccion (Parcial)` -> `510 - Temporal eventual por circunstancias de la produccion (Parcial)`

## Tables affected
- `empleados` (UPDATE only)

## Security
- No RLS policy changes.

## Notes
1. Idempotent: rows already prefixed with the code are skipped.
2. Codes `402` and `405` are left untouched (no description was provided).
*/

UPDATE empleados
SET tipo_contrato = '100 - Indefinido ordinario (Tiempo Completo)',
    updated_at = now()
WHERE tipo_contrato = 'Indefinido ordinario (Tiempo Completo)';

UPDATE empleados
SET tipo_contrato = '189 - Indefinido fijo-discontinuo (Tiempo Completo)',
    updated_at = now()
WHERE tipo_contrato = 'Indefinido fijo-discontinuo (Tiempo Completo)';

UPDATE empleados
SET tipo_contrato = '200 - Indefinido ordinario (Tiempo Parcial)',
    updated_at = now()
WHERE tipo_contrato = 'Indefinido ordinario (Tiempo Parcial)';

UPDATE empleados
SET tipo_contrato = '289 - Indefinido fijo-discontinuo (Tiempo Parcial)',
    updated_at = now()
WHERE tipo_contrato = 'Indefinido fijo-discontinuo (Tiempo Parcial)';

UPDATE empleados
SET tipo_contrato = '130 - Indefinido de formacion / practicas (Tiempo Completo)',
    updated_at = now()
WHERE tipo_contrato = 'Indefinido de formacion / practicas (Tiempo Completo)';

UPDATE empleados
SET tipo_contrato = '230 - Indefinido de formacion / practicas (Tiempo Parcial)',
    updated_at = now()
WHERE tipo_contrato = 'Indefinido de formacion / practicas (Tiempo Parcial)';

UPDATE empleados
SET tipo_contrato = '410 - Temporal eventual por circunstancias de la produccion (Completa)',
    updated_at = now()
WHERE tipo_contrato = 'Temporal eventual por circunstancias de la produccion (Completa)';

UPDATE empleados
SET tipo_contrato = '510 - Temporal eventual por circunstancias de la produccion (Parcial)',
    updated_at = now()
WHERE tipo_contrato = 'Temporal eventual por circunstancias de la produccion (Parcial)';
