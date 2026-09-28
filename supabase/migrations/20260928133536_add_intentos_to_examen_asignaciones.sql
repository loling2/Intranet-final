/*
# Add intentos column to examen_asignaciones

1. Modified Tables
- `examen_asignaciones`: add `intentos` integer NOT NULL DEFAULT 0.
  Tracks how many times the employee has attempted the exam.
2. Notes
- Does NOT lose existing data; column defaults to 0 for existing rows.
*/

ALTER TABLE public.examen_asignaciones
  ADD COLUMN IF NOT EXISTS intentos integer NOT NULL DEFAULT 0;