/*
# Make crm_notas.fecha nullable

1. Modified Tables
- `crm_notas`: `fecha` column changed from NOT NULL to nullable.
  Notes can now be saved without a date.
2. Notes
- Does NOT lose existing data; existing rows keep their dates.
*/

ALTER TABLE public.crm_notas ALTER COLUMN fecha DROP NOT NULL;