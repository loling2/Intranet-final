/*
# Map contract codes 402 and 405 to full descriptions

## Purpose
Add full descriptions for the two remaining contract codes that were left
untouched in prior migrations: `402` and `405`.

## Mapping
- `402` -> `402 - Temporal por obra o servicio determinado`
- `405` -> `405 - Temporal de fomento de empleo / insercion`

## Tables affected
- `empleados` (UPDATE only)

## Security
- No RLS policy changes.

## Notes
1. Idempotent: rows already holding the prefixed description are skipped.
*/

UPDATE empleados
SET tipo_contrato = '402 - Temporal por obra o servicio determinado',
    updated_at = now()
WHERE tipo_contrato = '402';

UPDATE empleados
SET tipo_contrato = '405 - Temporal de fomento de empleo / insercion',
    updated_at = now()
WHERE tipo_contrato = '405';
