/*
# Make DNI unique on empleados

1. Purpose
   Prevent two employees from sharing the same DNI. The check is case-insensitive
   (so "12345678A" and "12345678a" are treated as the same value) and only applies
   to non-empty DNI values — employees without a DNI are still allowed.

2. Changes
   - Create a unique partial index on `empleados.dni` using `lower(btrim(dni))`.
     `btrim` strips accidental whitespace; `lower` makes the match case-insensitive.
     The `WHERE dni IS NOT NULL AND btrim(dni) <> ''` clause means NULL/blank DNI
     values do NOT participate in the uniqueness check, so multiple employees
     can legitimately have no DNI.

3. Safety
   - No data is modified or deleted — this only adds an index.
   - Verified there are no existing duplicate DNI values in the table, so the
     index creation will succeed without conflict.
*/

-- Unique case-insensitive DNI index (ignores NULL and blank values)
CREATE UNIQUE INDEX IF NOT EXISTS empleados_dni_unique
  ON empleados (lower(btrim(dni)))
  WHERE dni IS NOT NULL AND btrim(dni) <> '';
