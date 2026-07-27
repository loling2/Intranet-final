/*
# Update tipo_contrato to full descriptive names

## Purpose
The `empleados.tipo_contrato` column historically stored a mix of numeric
contract codes (e.g. `100`, `200`, `189`) and generic text labels
(`Indefinido`, `Temporal`). This migration normalizes every existing row to
the full human-readable description associated with its contract code, so
that both the database and the UI dropdowns show consistent, detailed values.

## Schema change
- Widen `empleados.tipo_contrato` from `varchar(50)` to `varchar(120)` so the
  full descriptions fit. This does not lose data — it only increases the
  maximum length.

## Mapping applied (code -> description)
- `100` -> `Indefinido ordinario (Tiempo Completo)`
- `189` -> `Indefinido fijo-discontinuo (Tiempo Completo)`
- `200` -> `Indefinido ordinario (Tiempo Parcial)`
- `289` -> `Indefinido fijo-discontinuo (Tiempo Parcial)`
- `130` -> `Indefinido de formacion / practicas (Tiempo Completo)`
- `230` -> `Indefinido de formacion / practicas (Tiempo Parcial)`
- `410` -> `Temporal eventual por circunstancias de la produccion (Completa)`
- `510` -> `Temporal eventual por circunstancias de la produccion (Parcial)`

## Legacy text normalization
Generic text values that predate the coded system are mapped to their most
likely code equivalent before applying the full description:
- `Indefinido`  -> treated as `100` (indefinido ordinario tiempo completo)
- `Temporal`    -> treated as `410` (temporal eventual por circunstancias de
                  la produccion, completa)

## Tables affected
- `empleados` (one ALTER COLUMN + UPDATEs; no new tables, no new columns)

## Security
- No RLS policy changes. Existing policies remain in effect.

## Notes
1. Idempotent: rows already holding a full description will not match any of
   the legacy/code values, so re-running is safe.
2. Codes present in the data but NOT in the requested mapping (e.g. `402`,
   `405`) are left untouched, since no target description was specified for
   them.
3. No data is lost — the column is only widened and text values are rewritten
   in place.
*/

ALTER TABLE empleados ALTER COLUMN tipo_contrato TYPE varchar(120);

UPDATE empleados
SET tipo_contrato = 'Indefinido ordinario (Tiempo Completo)',
    updated_at = now()
WHERE tipo_contrato IN ('100', 'Indefinido');

UPDATE empleados
SET tipo_contrato = 'Indefinido fijo-discontinuo (Tiempo Completo)',
    updated_at = now()
WHERE tipo_contrato = '189';

UPDATE empleados
SET tipo_contrato = 'Indefinido ordinario (Tiempo Parcial)',
    updated_at = now()
WHERE tipo_contrato = '200';

UPDATE empleados
SET tipo_contrato = 'Indefinido fijo-discontinuo (Tiempo Parcial)',
    updated_at = now()
WHERE tipo_contrato = '289';

UPDATE empleados
SET tipo_contrato = 'Indefinido de formacion / practicas (Tiempo Completo)',
    updated_at = now()
WHERE tipo_contrato = '130';

UPDATE empleados
SET tipo_contrato = 'Indefinido de formacion / practicas (Tiempo Parcial)',
    updated_at = now()
WHERE tipo_contrato = '230';

UPDATE empleados
SET tipo_contrato = 'Temporal eventual por circunstancias de la produccion (Completa)',
    updated_at = now()
WHERE tipo_contrato IN ('410', 'Temporal');

UPDATE empleados
SET tipo_contrato = 'Temporal eventual por circunstancias de la produccion (Parcial)',
    updated_at = now()
WHERE tipo_contrato = '510';
