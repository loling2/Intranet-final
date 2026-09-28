/*
# Backfill centro_id from centro_trabajo text match

## Problem
Many employees have the center name in `centro_trabajo` (text field) but `centro_id`
is NULL. The PRL document filtering function `get_my_prl_documents()` filters by
`centro_id`, not by the text field, so these employees cannot see documents
assigned to their center. This affects 83+ employees in Tierra de Oro and
several other centers.

## Fix
Updates `empleados.centro_id` by matching `centro_trabajo` (case-insensitive,
trimmed) to `centros.nombre`. Only fills rows where centro_id is currently NULL.

## Tables affected
- `empleados` — centro_id backfilled from centros by name match.

## Security
No RLS policy changes.
*/

UPDATE empleados e
SET centro_id = c.id
FROM centros c
WHERE lower(trim(e.centro_trabajo)) = lower(trim(c.nombre))
  AND e.centro_id IS NULL;
