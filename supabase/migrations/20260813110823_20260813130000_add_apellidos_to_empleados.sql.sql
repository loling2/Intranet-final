/*
# Add apellidos column to empleados table

## Why
The frontend Empleado type and the employee edit form both include an `apellidos`
field, but the column was never created in the database. Every save (even with
no changes) sends `apellidos: null` in the payload, and Postgres rejects it
with "column does not exist" — which surfaces to the user as a generic
"Error al guardar" because the catch block doesn't handle Supabase error
objects (which are plain objects, not Error instances).

## Changes
1. Adds `apellidos` (text, nullable) to `empleados`.
2. No RLS changes needed — existing policies already cover the new column.

## Notes
- This is a non-destructive, additive migration.
- The column is nullable so existing rows are unaffected.
*/

ALTER TABLE empleados
  ADD COLUMN IF NOT EXISTS apellidos text;
